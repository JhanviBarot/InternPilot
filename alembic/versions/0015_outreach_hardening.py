"""Module 12 hardening — outreach unique constraint, timestamp columns, posted_at type fix.

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-20 00:00:00.000000

Fixes:
  - Adds UNIQUE(user_id, research_opportunity_id) to research_outreach (#22)
  - Adds contacted_at, replied_at nullable timestamp columns (#7)
  - Fixes research_opportunities.posted_at from String(50) to TIMESTAMPTZ (#24)
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Fix posted_at: String(50) → TIMESTAMPTZ. Existing ISO string values are cast
    # directly; NULL values remain NULL. Using USING clause for safe in-place conversion.
    op.execute(
        """
        ALTER TABLE research_opportunities
        ALTER COLUMN posted_at TYPE TIMESTAMPTZ
        USING CASE
            WHEN posted_at IS NULL OR posted_at = '' THEN NULL
            ELSE posted_at::timestamptz
        END
        """
    )

    # Fix last_seen_at too (same String type in migration, datetime in model)
    op.execute(
        """
        ALTER TABLE research_opportunities
        ALTER COLUMN last_seen_at TYPE TIMESTAMPTZ
        USING CASE
            WHEN last_seen_at IS NULL OR last_seen_at = '' THEN now()
            ELSE last_seen_at::timestamptz
        END
        """
    )

    # Add contacted_at and replied_at to research_outreach
    op.add_column(
        "research_outreach",
        sa.Column("contacted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "research_outreach",
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Add unique constraint — prevents duplicate outreach per user+opportunity
    op.create_unique_constraint(
        "uq_user_opp_outreach",
        "research_outreach",
        ["user_id", "research_opportunity_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_user_opp_outreach", "research_outreach", type_="unique")
    op.drop_column("research_outreach", "replied_at")
    op.drop_column("research_outreach", "contacted_at")
    op.execute(
        "ALTER TABLE research_opportunities ALTER COLUMN posted_at TYPE VARCHAR(50) USING posted_at::text"
    )
    op.execute(
        "ALTER TABLE research_opportunities ALTER COLUMN last_seen_at TYPE VARCHAR(50) USING last_seen_at::text"
    )
