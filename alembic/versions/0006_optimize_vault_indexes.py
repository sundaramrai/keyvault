"""optimize vault query indexes

Revision ID: 0006_optimize_vault_indexes
Revises: 0005_drop_mp_verifier
Create Date: 2026-03-22

"""

from alembic import op


revision = "0006_optimize_vault_indexes"
down_revision = "0005_drop_mp_verifier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_vault_items_user_updated")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_vault_items_user_deleted")

        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_vault_items_user_deleted_updated "
            "ON vault_items (user_id, is_deleted, updated_at)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_vault_items_user_deleted_category_updated "
            "ON vault_items (user_id, is_deleted, category, updated_at)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_vault_items_user_deleted_favourite_updated "
            "ON vault_items (user_id, is_deleted, is_favourite, updated_at)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_vault_items_user_deleted_favourite_updated")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_vault_items_user_deleted_category_updated")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_vault_items_user_deleted_updated")

        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_vault_items_user_updated "
            "ON vault_items (user_id, updated_at)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_vault_items_user_deleted "
            "ON vault_items (user_id, is_deleted)"
        )
