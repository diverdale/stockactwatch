"""Widen ticker column from VARCHAR(20) to TEXT.

Historical bulk data contains long option ticker symbols (e.g. AAPL230616C00185000)
that exceed the original 20-character limit.

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "trades",
        "ticker",
        type_=sa.Text(),
        existing_type=sa.String(20),
        existing_nullable=False,
    )
    # Also widen on ticker_meta and price_snapshots if they have the same constraint
    op.alter_column(
        "ticker_meta",
        "ticker",
        type_=sa.Text(),
        existing_type=sa.String(20),
        existing_nullable=False,
    )
    op.alter_column(
        "price_snapshots",
        "ticker",
        type_=sa.Text(),
        existing_type=sa.String(20),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "price_snapshots",
        "ticker",
        type_=sa.String(20),
        existing_type=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "ticker_meta",
        "ticker",
        type_=sa.String(20),
        existing_type=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "trades",
        "ticker",
        type_=sa.String(20),
        existing_type=sa.Text(),
        existing_nullable=False,
    )
