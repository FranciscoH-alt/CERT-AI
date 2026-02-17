"""Certification listing routes."""

from fastapi import APIRouter, Depends
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from models.schemas import Certification

router = APIRouter(prefix="/certifications", tags=["certifications"])


@router.get("/", response_model=list[Certification])
async def list_certifications(user_id: str = Depends(get_current_user_id)):
    """List all available certifications with question counts."""
    db = get_supabase()
    result = db.table("certifications").select("*").order("code").execute()

    certs = []
    for cert in result.data:
        # Get question count for this certification
        count_res = (
            db.table("questions")
            .select("id", count="exact")
            .eq("certification_id", cert["id"])
            .execute()
        )
        cert["question_count"] = count_res.count or 0
        certs.append(cert)

    return certs
