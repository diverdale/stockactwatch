"""add district to politicians

Revision ID: 0008
Revises: 0007
Create Date: 2025-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('politicians', sa.Column('district', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('politicians', 'district')
