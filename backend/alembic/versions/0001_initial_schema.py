"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-12 19:31:49.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Politicians table
    op.create_table(
        "politicians",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("party", sa.String(), nullable=True),
        sa.Column("chamber", sa.String(), nullable=True),
        sa.Column("state", sa.String(2), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )

    # Trades table
    op.create_table(
        "trades",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticker", sa.String(10), nullable=False),
        # INGEST-03: asset_type is NOT NULL — enforced from first migration
        sa.Column("asset_type", sa.String(), nullable=False),
        sa.Column("asset_description", sa.String(), nullable=True),
        sa.Column("transaction_type", sa.String(), nullable=False),
        # INGEST-05: separate columns for trade occurrence vs disclosure filing
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("disclosure_date", sa.Date(), nullable=False),
        # GENERATED column: filing_lag_days
        sa.Column(
            "filing_lag_days",
            sa.Integer(),
            sa.Computed("(disclosure_date - trade_date)", persisted=True),
            nullable=True,
        ),
        sa.Column("amount_range_raw", sa.String(), nullable=True),
        sa.Column("amount_lower", sa.Integer(), nullable=True),
        # NULL for $1M+ disclosures where upper bound is unbounded
        sa.Column("amount_upper", sa.Integer(), nullable=True),
        # GENERATED column: amount_midpoint
        sa.Column(
            "amount_midpoint",
            sa.Integer(),
            sa.Computed(
                "(amount_lower + COALESCE(amount_upper, amount_lower * 2)) / 2",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "owner",
            sa.String(),
            server_default=sa.text("'Self'"),
            nullable=False,
        ),
        # INGEST-02: tracks amendment versions
        sa.Column(
            "amendment_version",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        # LEGAL-02: set False for options to exclude from return calculations
        sa.Column(
            "return_calculable",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index("ix_trades_politician_id", "trades", ["politician_id"])
    op.create_index("ix_trades_ticker", "trades", ["ticker"])
    op.create_index(
        "ix_trades_disclosure_date", "trades", ["disclosure_date"], postgresql_using="btree"
    )
    op.create_index("ix_trades_asset_type", "trades", ["asset_type"])

    # Price snapshots table
    op.create_table(
        "price_snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("ticker", sa.String(10), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("close_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticker", "snapshot_date", name="uq_price_snapshots_ticker_date"),
    )
    op.create_index("ix_price_snapshots_ticker", "price_snapshots", ["ticker"])

    # Computed returns table
    op.create_table(
        "computed_returns",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("trade_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticker", sa.String(10), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("price_at_trade", sa.Numeric(12, 4), nullable=True),
        sa.Column("price_current", sa.Numeric(12, 4), nullable=True),
        sa.Column("return_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("return_dollar_est", sa.Numeric(14, 2), nullable=True),
        sa.Column("sp500_return_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column(
            "methodology_ver",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
        sa.Column(
            "computed_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"]),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_id"),
    )
    op.create_index("ix_computed_returns_politician_id", "computed_returns", ["politician_id"])
    op.create_index("ix_computed_returns_ticker", "computed_returns", ["ticker"])

    # Ingestion log table
    op.create_table(
        "ingestion_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("trades_fetched", sa.Integer(), nullable=True),
        sa.Column("trades_upserted", sa.Integer(), nullable=True),
        sa.Column("errors", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("ingestion_log")
    op.drop_index("ix_computed_returns_ticker", table_name="computed_returns")
    op.drop_index("ix_computed_returns_politician_id", table_name="computed_returns")
    op.drop_table("computed_returns")
    op.drop_index("ix_price_snapshots_ticker", table_name="price_snapshots")
    op.drop_table("price_snapshots")
    op.drop_index("ix_trades_asset_type", table_name="trades")
    op.drop_index("ix_trades_disclosure_date", table_name="trades")
    op.drop_index("ix_trades_ticker", table_name="trades")
    op.drop_index("ix_trades_politician_id", table_name="trades")
    op.drop_table("trades")
    op.drop_table("politicians")
