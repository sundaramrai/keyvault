from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from database import get_db, VaultItem, User
from schemas import VaultItemCreate, VaultItemUpdate, VaultItemResponse, VaultListResponse
from deps import get_current_user, get_current_user_from_db, TokenUser

router = APIRouter(prefix="/vault", tags=["vault"])

ITEM_NOT_FOUND_MSG = "Item not found"


@router.get("/export/json")
def export_vault(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_db),
):
    """Export all vault items as encrypted JSON (data remains encrypted)."""
    items = db.query(VaultItem).filter(VaultItem.user_id == current_user.id).all()
    return {
        "export_version": "1.0",
        "user_email": current_user.email,
        "vault_salt": current_user.vault_salt,
        "items": [
            {
                "id": str(item.id),
                "name": item.name,
                "category": item.category,
                "encrypted_data": item.encrypted_data,
                "favicon_url": item.favicon_url,
                "is_favourite": item.is_favourite,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ],
    }


@router.get("", response_model=VaultListResponse)
def list_items(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=128),
    favourites_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: TokenUser = Depends(get_current_user),
):
    query = db.query(VaultItem).filter(VaultItem.user_id == current_user.id)

    if category:
        query = query.filter(VaultItem.category == category)
    if search:
        query = query.filter(VaultItem.name.ilike(f"%{search}%"))
    if favourites_only:
        query = query.filter(VaultItem.is_favourite == True)

    query = query.order_by(VaultItem.updated_at.desc())
    items = query.all()

    return VaultListResponse(items=items, total=len(items))


@router.post("", response_model=VaultItemResponse, status_code=201)
def create_item(
    body: VaultItemCreate,
    db: Session = Depends(get_db),
    current_user: TokenUser = Depends(get_current_user),
):
    item = VaultItem(
        user_id=current_user.id,
        name=body.name,
        category=body.category,
        encrypted_data=body.encrypted_data,
        favicon_url=body.favicon_url,
        is_favourite=body.is_favourite,
    )
    db.add(item)
    db.commit()
    return item


@router.get("/{item_id}", response_model=VaultItemResponse)
def get_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: TokenUser = Depends(get_current_user),
):
    item = db.query(VaultItem).filter(
        VaultItem.id == item_id,
        VaultItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail=ITEM_NOT_FOUND_MSG)
    return item


@router.patch("/{item_id}", response_model=VaultItemResponse)
def update_item(
    item_id: UUID,
    body: VaultItemUpdate,
    db: Session = Depends(get_db),
    current_user: TokenUser = Depends(get_current_user),
):
    item = db.query(VaultItem).filter(
        VaultItem.id == item_id,
        VaultItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail=ITEM_NOT_FOUND_MSG)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: TokenUser = Depends(get_current_user),
):
    item = db.query(VaultItem).filter(
        VaultItem.id == item_id,
        VaultItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail=ITEM_NOT_FOUND_MSG)

    db.delete(item)
    db.commit()
