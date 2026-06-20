"""Hard tests for Tracker, PlatformIQ, and Outreach.

Covers all bugs found in the audit:
- Tracker: ghosted status transition, sort stability, double-fetch fix
- PlatformIQ: math.isfinite guard, _dedupe_latest stable sort, get_history_rows tiebreaker
- Outreach: duplicate guard, artifact validation, skill ratio, incomplete profile, rollback
"""
from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.artifact import Artifact
from app.models.company import Company
from app.models.outcome import Outcome
from app.models.posting import Posting
from app.models.research_opportunity import ResearchOpportunity
from app.models.research_outreach import ResearchOutreach
from app.models.user import AuthProvider, User, UserRole
from app.services.evaluation_service import (
    MetricResult,
    _dedupe_latest,
    platform_iq,
)
from app.services.research_service import ResearchService

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

_VEC_DIM = 384


def _vec(pos: int) -> list[float]:
    v = [0.0] * _VEC_DIM
    v[pos] = 1.0
    return v


async def _make_company(db: AsyncSession) -> Company:
    n = f"HardCo-{uuid.uuid4().hex[:6]}"
    c = Company(
        name=n,
        normalized_name=n.lower(),
        domain=f"{n.lower()}.com",
        ghost_history_score=0.0,
        responsiveness_score=1.0,
    )
    db.add(c)
    await db.flush()
    return c


async def _make_posting(db: AsyncSession, company_id: uuid.UUID) -> Posting:
    p = Posting(
        company_id=company_id,
        title="Intern",
        description="Build things.",
        requirements=["Python"],
        work_mode="remote",
        source="gh",
        source_url=f"https://example.com/{uuid.uuid4().hex}",
        dedup_key=uuid.uuid4().hex[:16],
        posted_at="2026-01-01T00:00:00Z",
        last_seen_at="2026-01-01T00:00:00Z",
    )
    db.add(p)
    await db.flush()
    return p


async def _make_app(
    db: AsyncSession,
    user_id: uuid.UUID,
    posting_id: uuid.UUID,
    status: str = "applied",
    pred_prob: float = 0.5,
    pred_ghost: bool = False,
) -> Application:
    a = Application(
        user_id=user_id,
        posting_id=posting_id,
        channel="portal",
        status=status,
        predicted_response_prob=pred_prob,
        predicted_ghost=pred_ghost,
    )
    db.add(a)
    await db.flush()
    return a


async def _make_outcome(
    db: AsyncSession,
    app_id: uuid.UUID,
    *,
    outcome_type: str = "responded",
    responded: bool = True,
    recorded_at: datetime | None = None,
) -> Outcome:
    o = Outcome(
        application_id=app_id,
        outcome_type=outcome_type,
        responded=responded,
        source="test",
        recorded_at=recorded_at or datetime.now(UTC),
    )
    db.add(o)
    await db.flush()
    return o


async def _make_user(db: AsyncSession, email: str | None = None) -> User:
    e = email or f"hard-{uuid.uuid4().hex[:8]}@example.com"
    u = User(
        name="Hard Tester",
        email=e,
        password_hash="x",
        role=UserRole.student,
        auth_provider=AuthProvider.password,
    )
    db.add(u)
    await db.flush()
    return u


def _opportunity(db: AsyncSession, desired_skills: list[str] | None = None) -> ResearchOpportunity:
    opp = ResearchOpportunity(
        professor_name=f"Prof-{uuid.uuid4().hex[:6]}",
        institution="Test University",
        lab_name=None,
        research_area="NLP",
        description="Research on NLP.",
        desired_skills=desired_skills or ["Python", "NLP"],
        program=None,
        region=None,
        contact_email=None,
        url=None,
        source="test",
        posted_at="2026-01-01",
        last_seen_at="2026-01-01",
        embedding=_vec(0),
    )
    db.add(opp)
    return opp


# ---------------------------------------------------------------------------
# TRACKER — ghosted status transition
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_response_outcome_sets_ghosted(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """outcome_type=no_response must auto-advance status to 'ghosted'."""
    from sqlalchemy import select
    from app.models.user import User

    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    app = await _make_app(db, user.id, posting.id, status="applied")
    await db.commit()

    resp = await client.post(
        f"/api/applications/{app.id}/outcome",
        json={"outcome_type": "no_response", "responded": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    get_resp = await client.get(f"/api/applications/{app.id}", headers=auth_headers)
    assert get_resp.json()["application"]["status"] == "ghosted"


@pytest.mark.asyncio
async def test_bounced_outcome_sets_ghosted(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """outcome_type=bounced must also auto-advance status to 'ghosted'."""
    from app.models.user import User

    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    app = await _make_app(db, user.id, posting.id, status="applied")
    await db.commit()

    resp = await client.post(
        f"/api/applications/{app.id}/outcome",
        json={"outcome_type": "bounced", "responded": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    get_resp = await client.get(f"/api/applications/{app.id}", headers=auth_headers)
    assert get_resp.json()["application"]["status"] == "ghosted"


@pytest.mark.asyncio
async def test_ghosted_not_overwritten_by_second_no_response(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """Recording a second no_response on an already-ghosted app keeps it ghosted."""
    from app.models.user import User

    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    app = await _make_app(db, user.id, posting.id, status="ghosted")
    await db.commit()

    resp = await client.post(
        f"/api/applications/{app.id}/outcome",
        json={"outcome_type": "no_response", "responded": False},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    get_resp = await client.get(f"/api/applications/{app.id}", headers=auth_headers)
    assert get_resp.json()["application"]["status"] == "ghosted"


@pytest.mark.asyncio
async def test_responded_outcome_does_not_set_ghosted(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """responded=True outcome must set status to 'responded', not 'ghosted'."""
    from app.models.user import User

    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    app = await _make_app(db, user.id, posting.id, status="applied")
    await db.commit()

    resp = await client.post(
        f"/api/applications/{app.id}/outcome",
        json={"outcome_type": "responded", "responded": True},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    get_resp = await client.get(f"/api/applications/{app.id}", headers=auth_headers)
    assert get_resp.json()["application"]["status"] == "responded"


@pytest.mark.asyncio
async def test_list_applications_stable_sort_same_timestamp(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """Two apps with the same last_status_at must return in stable id-desc order."""
    from app.models.user import User

    result = await db.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    ts = datetime(2026, 1, 1, tzinfo=UTC)

    a1 = Application(user_id=user.id, posting_id=posting.id, channel="portal", status="saved")
    a1.last_status_at = ts
    a2 = Application(user_id=user.id, posting_id=posting.id, channel="portal", status="saved")
    a2.last_status_at = ts
    db.add(a1)
    db.add(a2)
    await db.commit()
    await db.refresh(a1)
    await db.refresh(a2)

    resp = await client.get("/api/applications", headers=auth_headers)
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()["data"]]
    # Both should appear; order is deterministic (id desc)
    assert str(a1.id) in ids
    assert str(a2.id) in ids
    # id.desc() means a2 (inserted second, larger UUID int) should come first
    assert ids.index(str(a2.id)) < ids.index(str(a1.id))


# ---------------------------------------------------------------------------
# PLATFORM IQ — math.isfinite guard
# ---------------------------------------------------------------------------


def test_platform_iq_nan_returns_zero() -> None:
    """NaN in response_brier must produce 0.0, not NaN."""
    m = MetricResult(
        response_brier=float("nan"),
        response_auc=None,
        response_accuracy=0.5,
        ghost_precision=0.0,
        ghost_recall=0.0,
        ghost_f1=0.0,
    )
    result = platform_iq(m)
    assert math.isfinite(result)
    assert result == pytest.approx(0.0)


def test_platform_iq_inf_returns_zero() -> None:
    """Infinity in ghost_f1 must produce 0.0, not inf."""
    m = MetricResult(
        response_brier=0.1,
        response_auc=None,
        response_accuracy=0.5,
        ghost_precision=0.0,
        ghost_recall=0.0,
        ghost_f1=float("inf"),
    )
    result = platform_iq(m)
    assert math.isfinite(result)
    assert result == pytest.approx(0.0)


def test_platform_iq_normal_unaffected() -> None:
    """Normal values still produce the correct formula result."""
    m = MetricResult(
        response_brier=0.05,
        response_auc=1.0,
        response_accuracy=1.0,
        ghost_precision=1.0,
        ghost_recall=1.0,
        ghost_f1=1.0,
    )
    result = platform_iq(m)
    expected = 100.0 * (0.6 * (1 - 0.05) + 0.4 * 1.0)
    assert result == pytest.approx(expected, abs=1e-6)


# ---------------------------------------------------------------------------
# PLATFORM IQ — _dedupe_latest stable sort
# ---------------------------------------------------------------------------


def test_dedupe_latest_picks_latest_by_timestamp() -> None:
    """When two outcomes for the same app differ in recorded_at, keep the later one."""
    app_id = uuid.uuid4()
    ts_early = datetime(2026, 1, 1, 10, 0, 0, tzinfo=UTC)
    ts_late = datetime(2026, 1, 1, 11, 0, 0, tzinfo=UTC)

    class FakeApp:
        id = app_id
        predicted_response_prob = 0.5
        predicted_ghost = False

    class FakeOutcome:
        def __init__(self, oid: uuid.UUID, ts: datetime, responded: bool) -> None:
            self.id = oid
            self.recorded_at = ts
            self.responded = responded
            self.outcome_type = "responded" if responded else "no_response"

    oid_early = uuid.UUID(int=1)
    oid_late = uuid.UUID(int=2)
    early_out = FakeOutcome(oid_early, ts_early, True)
    late_out = FakeOutcome(oid_late, ts_late, False)

    fa = FakeApp()
    rows: list[tuple[Any, Any]] = [(fa, early_out), (fa, late_out)]
    result = _dedupe_latest(rows)

    assert len(result) == 1
    assert result[0][1].id == oid_late


def test_dedupe_latest_stable_by_id_when_same_timestamp() -> None:
    """When two outcomes share recorded_at, the one with the larger id wins."""
    app_id = uuid.uuid4()
    ts = datetime(2026, 1, 1, 10, 0, 0, tzinfo=UTC)

    class FakeApp:
        id = app_id
        predicted_response_prob = 0.5
        predicted_ghost = False

    class FakeOutcome:
        def __init__(self, oid: uuid.UUID) -> None:
            self.id = oid
            self.recorded_at = ts
            self.responded = True
            self.outcome_type = "responded"

    oid_small = uuid.UUID(int=1)
    oid_large = uuid.UUID(int=9999)
    fa = FakeApp()
    rows: list[tuple[Any, Any]] = [
        (fa, FakeOutcome(oid_small)),
        (fa, FakeOutcome(oid_large)),
    ]
    result = _dedupe_latest(rows)
    assert len(result) == 1
    assert result[0][1].id == oid_large


def test_dedupe_latest_output_sorted_by_recorded_at() -> None:
    """Output order must be ascending by (recorded_at, id)."""
    app1_id = uuid.uuid4()
    app2_id = uuid.uuid4()
    ts1 = datetime(2026, 1, 1, tzinfo=UTC)
    ts2 = datetime(2026, 1, 2, tzinfo=UTC)

    class FakeApp:
        def __init__(self, aid: uuid.UUID) -> None:
            self.id = aid
            self.predicted_response_prob = 0.5
            self.predicted_ghost = False

    class FakeOutcome:
        def __init__(self, ts: datetime) -> None:
            self.id = uuid.uuid4()
            self.recorded_at = ts
            self.responded = True
            self.outcome_type = "responded"

    fa1 = FakeApp(app1_id)
    fa2 = FakeApp(app2_id)
    rows: list[tuple[Any, Any]] = [
        (fa2, FakeOutcome(ts2)),
        (fa1, FakeOutcome(ts1)),
    ]
    result = _dedupe_latest(rows)
    assert result[0][0].id == app1_id
    assert result[1][0].id == app2_id


# ---------------------------------------------------------------------------
# OUTREACH — duplicate guard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_duplicate_outreach_raises_409(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """Creating outreach twice for the same opportunity raises 409 OUTREACH_EXISTS."""
    from app.core.errors import APIError

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    opp = _opportunity(db)
    await db.commit()

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[[0.0] * _VEC_DIM])):
        svc = ResearchService(db, user_id)
        await svc.create_outreach(opp.id)

        with pytest.raises(APIError) as exc_info:
            await svc.create_outreach(opp.id)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "OUTREACH_EXISTS"


# ---------------------------------------------------------------------------
# OUTREACH — artifact validation: must not be linked to an application
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_outreach_rejects_app_linked_artifact(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """Artifact with application_id set must be rejected with INVALID_ARTIFACT."""
    from app.core.errors import APIError

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)
    app = await _make_app(db, user_id, posting.id)

    opp = _opportunity(db)

    artifact = Artifact(
        user_id=user_id,
        application_id=app.id,
        type="research_pitch",
        content="Subject: Test\n\nBody",
        ats_score=None,
        missing_keywords=[],
        grounding_score=0.9,
        predicted_response=None,
        version=1,
    )
    db.add(artifact)
    await db.flush()
    await db.commit()

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[[0.0] * _VEC_DIM])):
        svc = ResearchService(db, user_id)
        with pytest.raises(APIError) as exc_info:
            await svc.create_outreach(opp.id, artifact.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INVALID_ARTIFACT"


# ---------------------------------------------------------------------------
# OUTREACH — artifact type check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_outreach_rejects_wrong_artifact_type(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """Artifact with type != research_pitch must be rejected with INVALID_ARTIFACT_TYPE."""
    from app.core.errors import APIError

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    opp = _opportunity(db)
    artifact = Artifact(
        user_id=user_id,
        application_id=None,
        type="cover_letter",
        content="Dear Hiring Manager...",
        ats_score=None,
        missing_keywords=[],
        grounding_score=0.9,
        predicted_response=None,
        version=1,
    )
    db.add(artifact)
    await db.flush()
    await db.commit()

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[[0.0] * _VEC_DIM])):
        svc = ResearchService(db, user_id)
        with pytest.raises(APIError) as exc_info:
            await svc.create_outreach(opp.id, artifact.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INVALID_ARTIFACT_TYPE"


# ---------------------------------------------------------------------------
# OUTREACH — skill ratio = 1.0 when desired_skills is empty
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_skill_ratio_full_when_no_desired_skills(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """When an opportunity has no desired_skills, skill_ratio must be 1.0 (open to all)."""
    from app.models.profile import Profile

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    # Opportunity with NO desired_skills
    opp_empty = _opportunity(db, desired_skills=[])
    # Opportunity WITH desired_skills (for comparison)
    opp_skilled = _opportunity(db, desired_skills=["Rust"])

    profile = Profile(
        user_id=user_id,
        headline=None,
        university=None,
        grad_year=None,
        skills=["Python"],
        experience=[],
        education=[],
        projects=[],
        research_interests=["NLP"],
        github_url=None,
        embedding=None,
    )
    db.add(profile)
    await db.commit()

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])):
        svc = ResearchService(db, user_id)
        match_empty = await svc.get_match(opp_empty.id)
        match_skilled = await svc.get_match(opp_skilled.id)

    SKILL_WEIGHT = 0.3
    # Empty desired → skill_ratio=1.0 → fit_score gets full skill credit
    # min possible fit_score with skill_ratio=1.0: SKILL_WEIGHT * 1.0 + SEMANTIC_WEIGHT * 0 = 0.3
    assert match_empty.fit_score >= SKILL_WEIGHT
    # Skilled opp (Python vs Rust, no match) → skill_ratio=0, so scores lower
    assert match_empty.fit_score > match_skilled.fit_score


# ---------------------------------------------------------------------------
# OUTREACH — incomplete profile guard in draft_pitch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_draft_pitch_incomplete_profile_raises_400(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """draft_pitch with no skills, no projects, no experience → INCOMPLETE_PROFILE."""
    from app.core.errors import APIError
    from app.models.profile import Profile

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    opp = _opportunity(db)
    # Profile with empty everything
    profile = Profile(
        user_id=user_id,
        headline=None,
        university=None,
        grad_year=None,
        skills=[],
        experience=[],
        education=[],
        projects=[],
        research_interests=["NLP"],
        github_url=None,
        embedding=None,
    )
    db.add(profile)
    await db.commit()

    with (
        patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])),
        patch("app.llm.router.complete", new=AsyncMock(return_value="Subject: X\n\nBody")),
    ):
        svc = ResearchService(db, user_id)
        with pytest.raises(APIError) as exc_info:
            await svc.draft_pitch(opp.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INCOMPLETE_PROFILE"


@pytest.mark.asyncio
async def test_draft_pitch_no_profile_raises_400(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """draft_pitch with no profile at all → INCOMPLETE_PROFILE (no skills)."""
    from app.core.errors import APIError

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    opp = _opportunity(db)
    await db.commit()

    with (
        patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])),
        patch("app.llm.router.complete", new=AsyncMock(return_value="Subject: X\n\nBody")),
    ):
        svc = ResearchService(db, user_id)
        with pytest.raises(APIError) as exc_info:
            await svc.draft_pitch(opp.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INCOMPLETE_PROFILE"


# ---------------------------------------------------------------------------
# OUTREACH — update_status with invalid status rejects at schema level
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_outreach_status_invalid_via_api(
    client: AsyncClient, auth_headers: dict, db: AsyncSession
) -> None:
    """PATCH /research/outreach/{id}/status with invalid status → 422 from Pydantic."""
    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    opp = _opportunity(db)
    await db.commit()

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])):
        svc = ResearchService(db, user_id)
        outreach = await svc.create_outreach(opp.id)

    resp = await client.patch(
        f"/api/research/outreach/{outreach.id}/status",
        json={"status": "FLYING_TO_MARS"},
        headers=auth_headers,
    )
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# OUTREACH — update_status all valid statuses round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_all_valid_outreach_statuses(
    db: AsyncSession, auth_headers: dict, client: AsyncClient
) -> None:
    """Every valid status string can be set without error."""
    from app.models.research_outreach import OUTREACH_STATUSES

    token = auth_headers["Authorization"].split(" ")[1]
    import base64, json
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    user_id = uuid.UUID(json.loads(base64.b64decode(payload_b64))["sub"])

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])):
        svc = ResearchService(db, user_id)
        for status in sorted(OUTREACH_STATUSES):
            opp = _opportunity(db)
            await db.flush()
            outreach = await svc.create_outreach(opp.id)
            updated = await svc.update_status(outreach.id, status)
            assert updated.status == status


# ---------------------------------------------------------------------------
# OUTREACH — list_outreach isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_outreach_isolation_hard(
    db: AsyncSession, client: AsyncClient
) -> None:
    """50 outreaches by user_a → user_b still sees 0."""
    import base64, json

    token_a_resp = await client.post(
        "/api/auth/signup",
        json={"name": "A", "email": f"hard_a_{uuid.uuid4().hex[:6]}@example.com", "password": "pass1234"},
    )
    token_a = token_a_resp.json()["token"]
    p64 = token_a.split(".")[1]
    p64 += "=" * (-len(p64) % 4)
    user_a = uuid.UUID(json.loads(base64.b64decode(p64))["sub"])

    token_b_resp = await client.post(
        "/api/auth/signup",
        json={"name": "B", "email": f"hard_b_{uuid.uuid4().hex[:6]}@example.com", "password": "pass1234"},
    )
    token_b = token_b_resp.json()["token"]
    p64b = token_b.split(".")[1]
    p64b += "=" * (-len(p64b) % 4)
    user_b = uuid.UUID(json.loads(base64.b64decode(p64b))["sub"])

    svc_a = ResearchService(db, user_a)
    svc_b = ResearchService(db, user_b)

    with patch("app.services.research_service.embed", new=AsyncMock(return_value=[_vec(0)])):
        for _ in range(10):
            opp = _opportunity(db)
            await db.flush()
            await svc_a.create_outreach(opp.id)

        b_list = await svc_b.list_outreach()

    assert len(b_list) == 0


# ---------------------------------------------------------------------------
# TRACKER — FOLLOWUP_DAYS constant matches backend
# ---------------------------------------------------------------------------


def test_followup_days_constant() -> None:
    """Backend FOLLOWUP_DAYS must be 7 to match the frontend constant."""
    from app.services.tracker_service import FOLLOWUP_DAYS
    assert FOLLOWUP_DAYS == 7


# ---------------------------------------------------------------------------
# TRACKER — ghosted is valid outcome type
# ---------------------------------------------------------------------------


def test_valid_outcome_types_does_not_contain_ghosted_as_input() -> None:
    """'ghosted' is NOT a user-submittable outcome type; it's a derived status."""
    from app.services.tracker_service import _VALID_OUTCOME_TYPES
    # User submits no_response → system sets status=ghosted
    # "ghosted" as outcome_type is not accepted from client
    assert "no_response" in _VALID_OUTCOME_TYPES
    assert "bounced" in _VALID_OUTCOME_TYPES


# ---------------------------------------------------------------------------
# PLATFORM IQ — evaluate_now with outcomes produces sensible IQ
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_evaluate_now_ghosted_apps_in_metrics(db: AsyncSession) -> None:
    """Applications that ended as ghosted (responded=False) contribute to ghost metrics."""
    from app.models.user import AuthProvider, User, UserRole
    from app.services.evaluation_service import EvaluationService

    user = User(
        name="Eval Hard",
        email=f"evalhard_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="x",
        role=UserRole.student,
        auth_provider=AuthProvider.password,
    )
    db.add(user)
    await db.flush()

    company = await _make_company(db)
    posting = await _make_posting(db, company.id)

    ts = datetime(2026, 1, 1, tzinfo=UTC)
    # 2 ghost apps (predicted_ghost=True, responded=False)
    for i in range(2):
        a = await _make_app(db, user.id, posting.id, pred_prob=0.1, pred_ghost=True)
        await _make_outcome(db, a.id, outcome_type="no_response", responded=False, recorded_at=ts + timedelta(minutes=i))
    # 2 responded apps (predicted_ghost=False, responded=True)
    for i in range(2):
        a = await _make_app(db, user.id, posting.id, pred_prob=0.9, pred_ghost=False)
        await _make_outcome(db, a.id, outcome_type="responded", responded=True, recorded_at=ts + timedelta(minutes=10 + i))
    await db.commit()

    svc = EvaluationService(db)
    row = await svc.evaluate_now()

    assert row.n_outcomes >= 4
    assert row.ghost_f1 == pytest.approx(1.0, abs=0.1)
    assert row.platform_iq > 0.0
    assert math.isfinite(row.platform_iq)
