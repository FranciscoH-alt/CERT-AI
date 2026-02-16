"""User profile routes.

These endpoints handle user profile retrieval and updates.
Authentication is handled client-side by Supabase Auth — the backend
validates the JWT and uses the user_id from the token.
"""

from fastapi import APIRouter, Depends
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from models.schemas import UserProfile, UpdateUserProfile

router = APIRouter(prefix="/user", tags=["user"])


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
