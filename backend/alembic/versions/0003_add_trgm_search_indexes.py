"""add pg_trgm extension and GIN search indexes

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must create extension FIRST — GIN indexes below require the gtrgm type
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # GIN trigram index on politicians.full_name — enables word_similarity <% operator
    op.create_index(
        "ix_politicians_full_name_trgm",
        "politicians",
        ["full_name"],
        postgresql_using="gin",
        postgresql_ops={"full_name": "gin_trgm_ops"},
    )

    # GIN trigram index on trades.ticker — enables trigram search for 3+ char tickers
    op.create_index(
        "ix_trades_ticker_trgm",
        "trades",
        ["ticker"],
        postgresql_using="gin",
        postgresql_ops={"ticker": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_trades_ticker_trgm", table_name="trades")
    op.drop_index("ix_politicians_full_name_trgm", table_name="politicians")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
