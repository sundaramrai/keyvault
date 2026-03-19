"""null legacy master password verifiers

Revision ID: 0004_null_legacy_verifiers
Revises: 0003_master_password_verifier
Create Date: 2026-03-19

"""
from alembic import op


revision = '0004_null_legacy_verifiers'
down_revision = '0003_master_password_verifier'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET master_password_verifier = NULL
        WHERE master_password_verifier IS NOT NULL
        """
    )


def downgrade() -> None:
    # Irreversible data cleanup: cleared verifier values cannot be restored.
    pass
