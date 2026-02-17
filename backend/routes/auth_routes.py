"""User profile and auth routes.

These endpoints handle user profile retrieval, updates, and auth helpers.
Authentication is handled client-side by Supabase Auth — the backend
validates the JWT and uses the user_id from the token.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from models.schemas import UserProfile, UpdateUserProfile
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
import httpx

router = APIRouter(prefix="/user", tags=["user"])


class ConfirmUserRequest(BaseModel):
    user_id: str


@router.post("/confirm")
async def confirm_user(req: ConfirmUserRequest):
    """Auto-confirm a user's email using the Supabase Admin API."""
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{req.user_id}",
            json={"email_confirm": True},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
        )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to confirm user")
    return {"confirmed": True}


@router.get("/profile", response_model=UserProfile)
async def get_profile(user_id: str = Depends(get_current_user_id)):
    """Get the current user's profile."""
    db = get_supabase()
    result = db.table("users").select("*").eq("id", user_id).single().execute()
    return result.data


@router.patch("/profile", response_model=UserProfile)
async def update_profile(
    updates: UpdateUserProfile,
    user_id: str = Depends(get_current_user_id),
):
    """Update the current user's profile (display name, theme preference)."""
    db = get_supabase()

    # Only include fields that were actually provided
    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        # Nothing to update — just return current profile
        result = db.table("users").select("*").eq("id", user_id).single().execute()
        return result.data

    result = (
        db.table("users")
        .update(update_data)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]
