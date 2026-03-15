"""add bio_guide_id to politicians and ticker_info table

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-13 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("politicians", sa.Column("bio_guide_id", sa.String(20), nullable=True))

    op.create_table(
        "ticker_info",
        sa.Column("ticker", sa.String(20), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("ticker_info")
    op.drop_column("politicians", "bio_guide_id")
