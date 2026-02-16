"""JWT authentication middleware for FastAPI.

Validates Supabase JWT tokens from the Authorization header
and extracts the user ID for route handlers.
"""

from fastapi import Request, HTTPException
from jose import jwt, JWTError
from config import SUPABASE_JWT_SECRET


async def get_current_user_id(request: Request) -> str:
    """Extract and validate user ID from the Supabase JWT in the Authorization header.

    Raises HTTPException 401 if the token is missing or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.split(" ")[1]

    try:
        # Supabase uses HS256 by default for JWT signing
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no subject")
        return user_id
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
