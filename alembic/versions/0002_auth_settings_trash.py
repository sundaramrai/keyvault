"""auth settings trash

Revision ID: 0002_auth_settings_trash
Revises: 0001_initial
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0002_auth_settings_trash'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('users', 'email_verified', server_default=None)

    op.add_column('vault_items', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('vault_items', sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.alter_column('vault_items', 'is_deleted', server_default=None)
    op.create_index('ix_vault_items_user_deleted', 'vault_items', ['user_id', 'is_deleted'])

    op.create_table(
        'auth_tokens',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('purpose', sa.String(64), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True)),
        sa.Column('consumed_at', sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index('ix_auth_tokens_user_id', 'auth_tokens', ['user_id'])
    op.create_index('ix_auth_tokens_purpose', 'auth_tokens', ['purpose'])


def downgrade() -> None:
    op.drop_index('ix_auth_tokens_purpose', table_name='auth_tokens')
    op.drop_index('ix_auth_tokens_user_id', table_name='auth_tokens')
    op.drop_table('auth_tokens')

    op.drop_index('ix_vault_items_user_deleted', table_name='vault_items')
    op.drop_column('vault_items', 'deleted_at')
    op.drop_column('vault_items', 'is_deleted')

    op.drop_column('users', 'email_verified')
