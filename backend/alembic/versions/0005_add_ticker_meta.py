"""add ticker_meta table for sector/industry enrichment

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-13 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Widen trades.ticker from varchar(10) to varchar(20) to accommodate longer option tickers
    op.alter_column(
        "trades",
        "ticker",
        existing_type=sa.String(10),
        type_=sa.String(20),
        existing_nullable=False,
    )

    op.create_table(
        "ticker_meta",
        sa.Column("ticker", sa.String(20), primary_key=True),
        sa.Column("sector", sa.String(100), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("sector_slug", sa.String(100), nullable=True),
        sa.Column("quote_type", sa.String(20), nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_ticker_meta_sector_slug", "ticker_meta", ["sector_slug"])
    op.create_index("ix_ticker_meta_sector", "ticker_meta", ["sector"])


def downgrade() -> None:
    op.drop_index("ix_ticker_meta_sector_slug", table_name="ticker_meta")
    op.drop_index("ix_ticker_meta_sector", table_name="ticker_meta")
    op.drop_table("ticker_meta")
    op.alter_column(
        "trades",
        "ticker",
        existing_type=sa.String(20),
        type_=sa.String(10),
        existing_nullable=False,
    )
