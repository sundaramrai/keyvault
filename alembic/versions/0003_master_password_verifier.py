"""master password verifier

Revision ID: 0003_master_password_verifier
Revises: 0002_auth_settings_trash
Create Date: 2026-03-15

"""
from alembic import op
import sqlalchemy as sa

revision = '0003_master_password_verifier'
down_revision = '0002_auth_settings_trash'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('master_password_verifier', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'master_password_verifier')
