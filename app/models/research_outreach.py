from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

OUTREACH_STATUSES = frozenset(
    {"suggested", "drafted", "contacted", "replied", "accepted", "declined", "no_response"}
)

# Valid forward transitions for the outreach state machine.
# Terminal states have empty sets; declined/no_response allow retry via "contacted".
OUTREACH_TRANSITIONS: dict[str, frozenset[str]] = {
    "suggested": frozenset({"drafted", "contacted", "no_response"}),
    "drafted": frozenset({"contacted", "suggested", "no_response"}),
    "contacted": frozenset({"replied", "no_response"}),
    "replied": frozenset({"accepted", "declined"}),
    "accepted": frozenset(),
    "declined": frozenset({"contacted"}),
    "no_response": frozenset({"contacted"}),
}


class ResearchOutreach(Base, TimestampMixin):
    """USER-OWNED — tracks outreach to a research opportunity."""

    __tablename__ = "research_outreach"
    __table_args__ = (
        UniqueConstraint("user_id", "research_opportunity_id", name="uq_user_opp_outreach"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    research_opportunity_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("research_opportunities.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="suggested",
        server_default="suggested",
    )
    pitch_artifact_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    replied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
