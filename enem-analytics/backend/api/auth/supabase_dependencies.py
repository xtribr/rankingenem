"""
Supabase Authentication Dependencies for FastAPI

Replaces JWT-based dependencies with Supabase token validation.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .supabase_service import authenticate_with_token, UserProfile

# Re-export UserProfile for convenience
__all__ = ["get_current_user", "get_current_admin", "get_optional_user", "UserProfile"]

# Security scheme
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserProfile:
    """
    Get the current authenticated user from Supabase token.

    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 403: User is deactivated
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    profile = authenticate_with_token(token)

    if profile is None:
        raise credentials_exception

    if not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário desativado"
        )

    return profile


async def get_current_admin(
    current_user: UserProfile = Depends(get_current_user)
) -> UserProfile:
    """
    Get the current user and verify admin status.

    Raises:
        HTTPException 403: User is not an admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores"
        )
    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security)
) -> Optional[UserProfile]:
    """
    Get current user if authenticated, None otherwise.

    Does not raise exceptions - returns None for unauthenticated requests.
    """
    if credentials is None:
        return None

    profile = authenticate_with_token(credentials.credentials)

    if profile is None or not profile.is_active:
        return None

    return profile


# Compatibility aliases (for gradual migration)
# These can be imported in place of the old dependencies

def get_db():
    """
    Dummy database dependency for compatibility.

    With Supabase, we don't need SQLAlchemy sessions anymore.
    This is a no-op that allows gradual migration.
    """
    return None
