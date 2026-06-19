"""USAJobs.gov source adapter — federal internship programmes across ALL fields.

Covers: engineering (chemical, mechanical, civil, electrical), science, IT,
business, finance, medicine, environmental, legal — any field where the US
government hires interns via PATHWAYS or Co-op programmes.

Requires free registration at https://developer.usajobs.gov/
Set in .env:
    USAJOBS_API_KEY=<your key>
    USAJOBS_EMAIL=<the email you registered with>

If either is empty, this source is silently skipped.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.sources.base import RawPosting

logger = logging.getLogger(__name__)

_BASE = "https://data.usajobs.gov/api/search"
_RESULTS_PER_PAGE = 500


def _parse_job(job: dict[str, Any]) -> RawPosting | None:
    matched = job.get("MatchedObjectDescriptor")
    if not isinstance(matched, dict):
        return None

    title = str(matched.get("PositionTitle") or "")
    if not title:
        return None

    org = matched.get("OrganizationName") or matched.get("DepartmentName") or "U.S. Government"
    url = str(matched.get("PositionURI") or matched.get("ApplyURI", [""])[0] or "")
    if not url:
        return None

    # Location
    locations = matched.get("PositionLocation") or []
    location: str | None = None
    if isinstance(locations, list) and locations:
        first_loc = locations[0]
        if isinstance(first_loc, dict):
            city = first_loc.get("CityName") or ""
            country = first_loc.get("CountryCode") or ""
            location = f"{city}, {country}".strip(", ") or None

    # Work mode — USAJobs often has telework info
    telework = str(matched.get("PositionSchedule", [{}])[0].get("Code") or "").lower()
    work_mode = "remote" if "full" in telework else None

    # Salary as monthly stipend estimate
    remuneration = matched.get("PositionRemuneration") or []
    stipend: int | None = None
    if isinstance(remuneration, list) and remuneration:
        pay = remuneration[0]
        if isinstance(pay, dict):
            try:
                annual = float(pay.get("MinimumRange") or 0)
                if annual > 0:
                    stipend = int(annual / 12)
            except (ValueError, TypeError):
                pass

    # Description — combine PublicationStartDate + qualification summary
    qual = matched.get("QualificationSummary") or ""
    duties = matched.get("UserArea", {}).get("Details", {}).get("JobSummary") or ""
    description = f"{duties}\n\n{qual}".strip() if (duties or qual) else title

    # Posted date
    posted_raw = str(matched.get("PublicationStartDate") or "")

    return {
        "title": title,
        "company_name": str(org),
        "description": description,
        "source": "usajobs",
        "source_url": url,
        "location": location,
        "work_mode": work_mode,
        "stipend": stipend,
        "posted_at": posted_raw or None,
        "requirements": [],
    }


class USAJobsSource:
    name = "usajobs"

    async def fetch(self) -> list[RawPosting]:
        api_key = settings.USAJOBS_API_KEY if hasattr(settings, "USAJOBS_API_KEY") else ""
        email = settings.USAJOBS_EMAIL if hasattr(settings, "USAJOBS_EMAIL") else ""
        if not api_key or not email:
            logger.debug("USAJobsSource: USAJOBS_API_KEY or USAJOBS_EMAIL not set — skipping")
            return []

        results: list[RawPosting] = []
        headers = {
            "Host": "data.usajobs.gov",
            "User-Agent": email,
            "Authorization-Key": api_key,
        }
        params: dict[str, str | int] = {
            "Keyword": "intern OR internship",
            "NumberOfResults": _RESULTS_PER_PAGE,
            "Fields": "Minimum",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(_BASE, headers=headers, params=params)
                if resp.status_code != 200:
                    logger.warning("USAJobs returned %d: %s", resp.status_code, resp.text[:200])
                    return results
                data = resp.json()
                jobs = (
                    data.get("SearchResult", {})
                    .get("SearchResultItems", [])
                )
                for item in jobs:
                    if not isinstance(item, dict):
                        continue
                    parsed = _parse_job(item)
                    if parsed:
                        results.append(parsed)
        except Exception as exc:  # noqa: BLE001
            logger.warning("USAJobsSource error: %s", exc)

        logger.info("USAJobs: fetched %d raw postings", len(results))
        return results
