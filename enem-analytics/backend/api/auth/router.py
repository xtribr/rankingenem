"""Authentication routes - Supabase Auth

Login is handled directly by Supabase on the frontend.
This module provides endpoints to get user profile data.
"""
from fastapi import APIRouter, Depends

from .supabase_dependencies import get_current_user, UserProfile

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/me")
async def get_me(current_user: UserProfile = Depends(get_current_user)):
    """
    Get current authenticated user info.

    Requires valid Supabase access token in Authorization header.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "codigo_inep": current_user.codigo_inep,
        "nome_escola": current_user.nome_escola,
        "is_admin": current_user.is_admin,
        "is_active": current_user.is_active,
    }
