"""Drop interview_preps table — Module 9 removed.

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-17 00:00:00.000000
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
    op.drop_table("interview_preps")


def downgrade() -> None:
    op.create_table(
        "interview_preps",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "application_id",
            sa.UUID(),
            sa.ForeignKey("applications.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("company_name", sa.String(500), nullable=False),
        sa.Column("role", sa.String(500), nullable=False),
        sa.Column("opportunity_type", sa.String(50), nullable=False, server_default="company"),
        sa.Column("region", sa.String(200), nullable=True),
        sa.Column("company_type", sa.String(50), nullable=False, server_default="unknown"),
        sa.Column("questions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("weak_spots", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("reverse_questions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
