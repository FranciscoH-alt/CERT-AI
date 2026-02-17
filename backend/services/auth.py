"""JWT authentication middleware for FastAPI.

Validates Supabase JWT tokens from the Authorization header
and extracts the user ID for route handlers.

Supabase uses ES256 (ECDSA) JWTs signed with asymmetric keys.
The public keys are fetched from the Supabase JWKS endpoint.
"""

import httpx
from fastapi import Request, HTTPException
from jose import jwt, JWTError, jwk
from config import SUPABASE_URL

# Cache the JWKS keys so we don't fetch them on every request
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    """Fetch and cache the JWKS (JSON Web Key Set) from Supabase."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        )
        response.raise_for_status()
        _jwks_cache = response.json()
    return _jwks_cache


def _find_key(jwks: dict, kid: str) -> dict:
    """Find the matching key in the JWKS by key ID."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise ValueError(f"No matching key found for kid: {kid}")


async def get_current_user_id(request: Request) -> str:
    """Extract and validate user ID from the Supabase JWT in the Authorization header.

    Raises HTTPException 401 if the token is missing or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.split(" ")[1]

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg", "ES256")

        # Fetch the public key from Supabase JWKS
        jwks = await _get_jwks()
        key_data = _find_key(jwks, kid)
        public_key = jwk.construct(key_data, algorithm=alg)

        payload = jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no subject")
        return user_id
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")
