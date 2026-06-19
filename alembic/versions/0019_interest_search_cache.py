"""Add interest_search_cache table for live interest-based fetching TTL.

Revision ID: 0019
Revises: 0018
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0019"
down_revision: str = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interest_search_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("fingerprint", sa.Text(), nullable=False, unique=True),
        sa.Column("search_terms", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("last_fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_interest_search_cache_fingerprint", "interest_search_cache", ["fingerprint"])


def downgrade() -> None:
    op.drop_index("ix_interest_search_cache_fingerprint", "interest_search_cache")
    op.drop_table("interest_search_cache")
