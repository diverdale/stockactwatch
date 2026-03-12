"""add ix_trades_trade_date index

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-12 23:38:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_trades_trade_date", "trades", ["trade_date"], postgresql_using="btree")


def downgrade() -> None:
    op.drop_index("ix_trades_trade_date", table_name="trades")
