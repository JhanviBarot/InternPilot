"""InterestSearchCache — tracks which interest profiles have been live-searched recently."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class InterestSearchCache(Base, TimestampMixin):
    __tablename__ = "interest_search_cache"

    fingerprint: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    search_terms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    last_fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    result_count: Mapped[int] = mapped_column(nullable=False, default=0)
