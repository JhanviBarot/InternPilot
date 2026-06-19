"""JSearch (RapidAPI) source — aggregates LinkedIn, Indeed, and Glassdoor.

Free tier: 200 requests/month.
Register at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

Set in .env:
    JSEARCH_API_KEY=<your rapidapi key>

If the key is absent this source is silently skipped.
"""
from __future__ import annotations

import logging
import re

import httpx

from app.sources.base import RawPosting

logger = logging.getLogger(__name__)

_BASE = "https://jsearch.p.rapidapi.com/search"
_HOST = "jsearch.p.rapidapi.com"
_MAX_PAGES = 2   # 10 results/page × 2 pages = 20 per term; conserves free-tier quota


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()


def _parse_job(job: dict) -> RawPosting | None:
    title = str(job.get("job_title") or "").strip()
    company = str(job.get("employer_name") or "").strip()
    url = str(job.get("job_apply_link") or job.get("job_google_link") or "").strip()

    if not title or not url:
        return None

    description = _strip_html(str(job.get("job_description") or ""))

    # Location
    city = str(job.get("job_city") or "")
    state = str(job.get("job_state") or "")
    country = str(job.get("job_country") or "")
    parts = [p for p in [city, state, country] if p]
    location: str | None = ", ".join(parts) or None

    # Work mode
    is_remote = job.get("job_is_remote")
    work_mode: str | None = "remote" if is_remote else None

    # Salary → monthly estimate
    stipend: int | None = None
    sal_min = job.get("job_min_salary")
    sal_period = str(job.get("job_salary_period") or "").lower()
    if isinstance(sal_min, int | float) and sal_min > 0:
        if "hour" in sal_period:
            stipend = int(sal_min * 160)        # 160 hr/month
        elif "year" in sal_period or "annual" in sal_period:
            stipend = int(sal_min / 12)
        elif "month" in sal_period:
            stipend = int(sal_min)
        if stipend and not (200 <= stipend <= 20_000):
            stipend = None

    posted_at = str(job.get("job_posted_at_datetime_utc") or "") or None

    return {
        "title": title,
        "company_name": company,
        "description": description,
        "source": "jsearch",
        "source_url": url,
        "location": location,
        "work_mode": work_mode,
        "stipend": stipend,
        "posted_at": posted_at,
        "requirements": [],
    }


class JSearchSource:
    name = "jsearch"

    async def fetch_by_term(self, term: str, api_key: str) -> list[RawPosting]:
        results: list[RawPosting] = []
        headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": _HOST,
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            for page in range(1, _MAX_PAGES + 1):
                try:
                    resp = await client.get(
                        _BASE,
                        headers=headers,
                        params={
                            "query": term,
                            "page": page,
                            "num_pages": "1",
                            "date_posted": "month",
                        },
                    )
                    if resp.status_code != 200:
                        logger.warning("JSearch %r page %d → %d", term, page, resp.status_code)
                        break
                    data = resp.json()
                    if data.get("status") != "OK":
                        break
                    jobs: list = data.get("data") or []
                    if not jobs:
                        break
                    for job in jobs:
                        parsed = _parse_job(job)
                        if parsed:
                            results.append(parsed)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("JSearch %r page %d error: %s", term, page, exc)
                    break
        return results
