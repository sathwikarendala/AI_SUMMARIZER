from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from database.db import get_db, SummaryHistory

router = APIRouter()


@router.get("/history")
def get_history(
    limit: int = 20,
    offset: int = 0,
    source_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return paginated summary history."""
    query = db.query(SummaryHistory)
    if source_type:
        query = query.filter(SummaryHistory.source_type == source_type)
    total = query.count()
    items = (
        query.order_by(SummaryHistory.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "total": total,
        "items": [
            {
                "id": item.id,
                "source_type": item.source_type,
                "source_name": item.source_name,
                "text_preview": item.text_preview,
                "summary": item.summary,
                "model_used": item.model_used,
                "language": item.language,
                "length_mode": item.length_mode,
                "original_words": item.original_words,
                "summary_words": item.summary_words,
                "reduction_pct": item.reduction_pct,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
    }


@router.get("/history/{item_id}")
def get_history_item(item_id: int, db: Session = Depends(get_db)):
    """Get a specific history item by ID."""
    item = db.query(SummaryHistory).filter(SummaryHistory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="History item not found")
    return {
        "success": True,
        "id": item.id,
        "source_type": item.source_type,
        "source_name": item.source_name,
        "text_preview": item.text_preview,
        "summary": item.summary,
        "model_used": item.model_used,
        "language": item.language,
        "length_mode": item.length_mode,
        "original_words": item.original_words,
        "summary_words": item.summary_words,
        "reduction_pct": item.reduction_pct,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.delete("/history/{item_id}")
def delete_history_item(item_id: int, db: Session = Depends(get_db)):
    """Delete a specific history item."""
    item = db.query(SummaryHistory).filter(SummaryHistory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="History item not found")
    db.delete(item)
    db.commit()
    return {"success": True, "message": f"History item {item_id} deleted"}


@router.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    """Delete ALL history items."""
    count = db.query(SummaryHistory).count()
    db.query(SummaryHistory).delete()
    db.commit()
    return {"success": True, "message": f"Cleared {count} history items"}
