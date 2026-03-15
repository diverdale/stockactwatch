"""Add suspicion_score and suspicion_flags columns to trades.

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-15
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("suspicion_score", sa.Integer(), nullable=True))
    op.add_column("trades", sa.Column("suspicion_flags", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "suspicion_flags")
    op.drop_column("trades", "suspicion_score")
