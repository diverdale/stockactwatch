"""add politician_committees table

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "politician_committees",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "politician_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("committee_code", sa.String(20), nullable=False),
        sa.Column("committee_name", sa.Text, nullable=False),
        sa.Column("role", sa.String(50), nullable=True),
        sa.Column("chamber", sa.String(10), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["politician_id"],
            ["politicians.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("politician_id", "committee_code", name="uq_politician_committee"),
    )
    op.create_index(
        "ix_politician_committees_politician_id",
        "politician_committees",
        ["politician_id"],
    )
    op.create_index(
        "ix_politician_committees_committee_code",
        "politician_committees",
        ["committee_code"],
    )


def downgrade() -> None:
    op.drop_index("ix_politician_committees_committee_code", table_name="politician_committees")
    op.drop_index("ix_politician_committees_politician_id", table_name="politician_committees")
    op.drop_table("politician_committees")
