"""Certification listing routes."""

from fastapi import APIRouter, Depends
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from models.schemas import Certification

router = APIRouter(prefix="/certifications", tags=["certifications"])


@router.get("/", response_model=list[Certification])
async def list_certifications(user_id: str = Depends(get_current_user_id)):
    """List all available certifications."""
    db = get_supabase()
    result = db.table("certifications").select("*").order("code").execute()
    return result.data
