"""Add recent_paper JSON column to research_opportunities.

Revision ID: 0017
Revises: 0016
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0017"
down_revision: str = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "research_opportunities",
        sa.Column("recent_paper", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("research_opportunities", "recent_paper")
