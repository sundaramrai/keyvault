from typing import Any


def serialize_vault_item(item: Any, *, include_encrypted_data: bool) -> dict[str, Any]:
    data = {
        "id": str(item.id),
        "name": item.name,
        "category": item.category,
        "favicon_url": item.favicon_url,
        "is_favourite": item.is_favourite,
        "is_deleted": item.is_deleted,
        "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }
    if include_encrypted_data:
        data["encrypted_data"] = item.encrypted_data
    return data
