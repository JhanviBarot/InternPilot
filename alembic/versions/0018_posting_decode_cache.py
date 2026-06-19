"""Add decode_cache JSON column to postings.

Revision ID: 0018
Revises: 0017
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0018"
down_revision: str = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "postings",
        sa.Column("decode_cache", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("postings", "decode_cache")
