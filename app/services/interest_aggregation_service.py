"""InterestAggregationService — live, interest-driven fetching with TTL caching.

Flow:
  1. User visits /matches → fingerprint their skills + research_interests.
  2. If fingerprint is missing or expired (>TTL_HOURS old) → background-fetch
     live postings from Adzuna + USAJobs using derived search terms.
  3. Cache hit → skip fetch, return existing ranked matches immediately.
  4. Another user with a near-identical profile shares the same fingerprint
     and therefore shares the cache — no duplicate fetching.

TTL is 48 h for company internships.  A new field of interest always triggers
a fresh fetch because its fingerprint won't exist in the cache yet.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interest_search_cache import InterestSearchCache
from app.sources.base import RawPosting

logger = logging.getLogger(__name__)

TTL_HOURS = 48
MAX_TERMS = 5
PAGES_PER_TERM = 2      # Adzuna free: 250 calls/month; 2 pages × 50 results = 100 per term
ADZUNA_PER_PAGE = 50

# Skills that are too generic or tool-specific to produce good Adzuna results
_SKIP_SKILLS = {
    "git", "github", "linux", "bash", "http", "html", "css", "json", "xml",
    "rest", "excel", "word", "powerpoint", "google", "microsoft", "postman",
    "cursor", "n8n", "rest apis", "object-oriented programming", "oop",
    "data structures", "data structures & algorithms", "algorithms",
    "sentiment analysis",  # academic, not great as job search term standalone
}


# ---------------------------------------------------------------------------
# Pure helpers (no DB needed)
# ---------------------------------------------------------------------------

def make_fingerprint(skills: list[str], research_interests: list[str]) -> str:
    """Stable 32-char hash of sorted interests → shared cache key."""
    canonical = sorted(
        s.lower().strip() for s in (skills[:10] + research_interests) if s.strip()
    )
    return hashlib.sha256(",".join(canonical).encode()).hexdigest()[:32]


def extract_search_terms(skills: list[str], research_interests: list[str]) -> list[str]:
    """Derive up to MAX_TERMS meaningful search queries from a user's profile."""
    terms: list[str] = []

    # Research interests are the most domain-specific signal
    for interest in research_interests[:3]:
        interest = interest.strip()
        if interest and len(interest) > 2:
            terms.append(f"{interest} internship")

    # Technical skills — filter out generic/tool keywords
    meaningful = [
        s for s in skills
        if s.lower().strip() not in _SKIP_SKILLS and len(s) > 2
    ]
    for skill in meaningful[: MAX_TERMS - len(terms)]:
        terms.append(f"{skill} internship")

    # Always have at least one term
    if not terms:
        terms = ["software engineering internship", "technology internship"]

    return terms[:MAX_TERMS]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class InterestAggregationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def is_stale(self, fingerprint: str) -> bool:
        """True when cache is absent or past TTL."""
        row = (
            await self.db.execute(
                select(InterestSearchCache).where(
                    InterestSearchCache.fingerprint == fingerprint
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return True
        return row.expires_at < datetime.now(UTC)

    async def refresh(
        self,
        fingerprint: str,
        skills: list[str],
        research_interests: list[str],
    ) -> int:
        """Fetch live postings for the given interest profile and persist them."""
        terms = extract_search_terms(skills, research_interests)
        logger.info("interest_refresh fingerprint=%s terms=%s", fingerprint[:8], terms)

        from app.core.config import settings

        raws: list[RawPosting] = []

        # ── Adzuna (keyword-searchable, cross-industry) ─────────────────────
        adzuna_id = getattr(settings, "ADZUNA_APP_ID", "")
        adzuna_key = getattr(settings, "ADZUNA_APP_KEY", "")
        adzuna_country = getattr(settings, "ADZUNA_COUNTRY", "us")
        if adzuna_id and adzuna_key:
            for term in terms:
                raws.extend(
                    await _adzuna_search(term, adzuna_id, adzuna_key, adzuna_country)
                )

        # ── USAJobs (free, broad government + research internships) ─────────
        usa_key = getattr(settings, "USAJOBS_API_KEY", "")
        usa_email = getattr(settings, "USAJOBS_EMAIL", "")
        if usa_key and usa_email:
            for term in terms[:3]:  # USAJobs is slower; limit to top 3 terms
                raws.extend(await _usajobs_search(term, usa_key, usa_email))

        # ── Persist via aggregation service ─────────────────────────────────
        from app.services.aggregation_service import AggregationService
        from app.services.ghost_service import GhostService

        agg = AggregationService(self.db)
        ingested = 0
        for raw in raws:
            try:
                duped = await agg._upsert_one(raw)
                if not duped:
                    ingested += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("upsert_failed title=%s error=%s", raw.get("title"), exc)
                await self.db.rollback()

        await GhostService(self.db).rescore_all()

        # ── Update cache entry ───────────────────────────────────────────────
        now = datetime.now(UTC)
        existing = (
            await self.db.execute(
                select(InterestSearchCache).where(
                    InterestSearchCache.fingerprint == fingerprint
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.search_terms = terms
            existing.last_fetched_at = now
            existing.expires_at = now + timedelta(hours=TTL_HOURS)
            existing.result_count = ingested
        else:
            self.db.add(
                InterestSearchCache(
                    fingerprint=fingerprint,
                    search_terms=terms,
                    last_fetched_at=now,
                    expires_at=now + timedelta(hours=TTL_HOURS),
                    result_count=ingested,
                )
            )
        await self.db.commit()

        logger.info(
            "interest_refresh_done fingerprint=%s ingested=%d terms=%s",
            fingerprint[:8], ingested, terms,
        )
        return ingested


# ---------------------------------------------------------------------------
# Background task entry-point (creates its own session so it survives the
# HTTP request lifecycle)
# ---------------------------------------------------------------------------

async def refresh_interests_background(
    fingerprint: str,
    skills: list[str],
    research_interests: list[str],
) -> None:
    """Fire-and-forget coroutine; always creates a fresh DB session."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            svc = InterestAggregationService(db)
            await svc.refresh(fingerprint, skills, research_interests)
        except Exception as exc:  # noqa: BLE001
            logger.error("background_refresh_failed error=%s", exc)


# ---------------------------------------------------------------------------
# Source helpers (lean versions that accept custom search terms)
# ---------------------------------------------------------------------------

async def _adzuna_search(
    term: str,
    app_id: str,
    app_key: str,
    country: str,
) -> list[RawPosting]:
    from app.sources.adzuna import _parse_job as _adzuna_parse

    results: list[RawPosting] = []
    base = f"https://api.adzuna.com/v1/api/jobs/{country}/search/{{page}}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        for page in range(1, PAGES_PER_TERM + 1):
            try:
                resp = await client.get(
                    base.format(page=page),
                    params={
                        "app_id": app_id,
                        "app_key": app_key,
                        "what": term,
                        "results_per_page": ADZUNA_PER_PAGE,
                        "content-type": "application/json",
                        "sort_by": "date",
                    },
                )
                if resp.status_code != 200:
                    break
                for job in resp.json().get("results") or []:
                    parsed = _adzuna_parse(job)
                    if parsed:
                        results.append(parsed)
            except Exception as exc:  # noqa: BLE001
                logger.warning("adzuna_search term=%r page=%d error=%s", term, page, exc)
                break

    return results


async def _usajobs_search(term: str, api_key: str, email: str) -> list[RawPosting]:
    from app.sources.usajobs import _parse_job as _usa_parse

    results: list[RawPosting] = []
    headers = {
        "Host": "data.usajobs.gov",
        "User-Agent": email,
        "Authorization-Key": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                "https://data.usajobs.gov/api/search",
                headers=headers,
                params={"Keyword": term, "NumberOfResults": 100, "Fields": "Minimum"},
            )
            if resp.status_code == 200:
                for item in (
                    resp.json()
                    .get("SearchResult", {})
                    .get("SearchResultItems", [])
                ):
                    parsed = _usa_parse(item)
                    if parsed:
                        results.append(parsed)
    except Exception as exc:  # noqa: BLE001
        logger.warning("usajobs_search term=%r error=%s", term, exc)

    return results
