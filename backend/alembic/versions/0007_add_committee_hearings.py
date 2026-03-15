"""add committee_hearings table

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "committee_hearings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("committee_code", sa.String(20), nullable=False),
        sa.Column("committee_name", sa.Text, nullable=False),
        sa.Column("hearing_date", sa.Date, nullable=False),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("meeting_type", sa.String(20), nullable=True),
        sa.Column("congress", sa.Integer, nullable=False),
        sa.Column("event_id", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("committee_code", "event_id", name="uq_committee_hearing_code_event"),
    )
    op.create_index(
        "ix_committee_hearings_committee_code",
        "committee_hearings",
        ["committee_code"],
    )
    op.create_index(
        "ix_committee_hearings_hearing_date",
        "committee_hearings",
        ["hearing_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_committee_hearings_hearing_date", table_name="committee_hearings")
    op.drop_index("ix_committee_hearings_committee_code", table_name="committee_hearings")
    op.drop_table("committee_hearings")
