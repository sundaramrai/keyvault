"""drop master password verifier

Revision ID: 0005_drop_mp_verifier
Revises: 0004_null_legacy_verifiers
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa


revision = '0005_drop_mp_verifier'
down_revision = '0004_null_legacy_verifiers'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('users', 'master_password_verifier')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column('master_password_verifier', sa.String(length=64), nullable=True),
    )
