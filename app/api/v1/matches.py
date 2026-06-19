"""Matching & Ranking endpoints — Module 3."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import APIError
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.match import MatchListResponse, MatchResponse, SkillGapsResponse
from app.services.interest_aggregation_service import (
    InterestAggregationService,
    make_fingerprint,
    refresh_interests_background,
)
from app.services.matching_service import MatchingService
from app.services.profile_service import ProfileService

router = APIRouter(tags=["matches"])


# ---------------------------------------------------------------------------
# GET /api/matches — ranked feed for the authenticated user
# ---------------------------------------------------------------------------

@router.get("/matches")
async def list_matches(
    work_mode: str | None = Query(default=None),
    domain: str | None = Query(default=None),
    include_ghosts: bool = Query(default=False),
    sort: str = Query(default="expected_value"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchListResponse:
    # ── Live interest refresh ────────────────────────────────────────────────
    # Derive interest fingerprint from the user's profile. If we haven't
    # searched live sources for this interest profile within the TTL window,
    # fire a background fetch so fresh postings are available on next load.
    fetching = False
    try:
        profile_svc = ProfileService(db, current_user.id)
        profile = await profile_svc.get_or_create()
        if profile and (profile.skills or profile.research_interests):
            fp = make_fingerprint(profile.skills, profile.research_interests)
            agg_svc = InterestAggregationService(db)
            if await agg_svc.is_stale(fp):
                # Launch background task — response returns immediately with
                # current (possibly empty) matches while fetch runs in parallel.
                asyncio.create_task(
                    refresh_interests_background(
                        fp, profile.skills, profile.research_interests
                    )
                )
                fetching = True
    except Exception:  # noqa: BLE001
        pass  # never block the match response due to refresh logic

    # ── Return current matches ───────────────────────────────────────────────
    svc = MatchingService(db, current_user.id)
    matches, total = await svc.get_matches(
        work_mode=work_mode,
        domain=domain,
        include_ghosts=include_ghosts,
        sort=sort,
        page=page,
        limit=limit,
    )
    return MatchListResponse(
        data=matches, page=page, limit=limit, total=total, fetching=fetching
    )


# ---------------------------------------------------------------------------
# GET /api/matches/:posting_id — single match detail
# ---------------------------------------------------------------------------

@router.get("/matches/{posting_id}")
async def get_match_detail(
    posting_id: uuid.UUID,
    enrich: bool = Query(default=False, description="Call LLM for richer explanation"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchResponse:
    svc = MatchingService(db, current_user.id)
    match = await svc.get_match_detail(posting_id, enrich=enrich)
    if match is None:
        raise APIError(404, "POSTING_NOT_FOUND", "Posting not found")
    return MatchResponse(match=match)


# ---------------------------------------------------------------------------
# GET /api/skill-gaps — missing skills ranked by unlockable roles
# ---------------------------------------------------------------------------

@router.get("/skill-gaps")
async def get_skill_gaps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SkillGapsResponse:
    svc = MatchingService(db, current_user.id)
    gaps = await svc.get_skill_gaps()
    return SkillGapsResponse(gaps=gaps)
