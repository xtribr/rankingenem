"""Authorization helpers for school-scoped and admin-only access."""

from fastapi import Depends, HTTPException, status

from .supabase_dependencies import UserProfile, get_current_user


def ensure_school_access(current_user: UserProfile, codigo_inep: str) -> UserProfile:
    """Allow admins to access any school and school users only their own."""
    if current_user.is_admin:
        return current_user

    if not current_user.codigo_inep or current_user.codigo_inep != codigo_inep:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito aos dados da sua escola",
        )

    return current_user


async def get_authorized_school_user(
    codigo_inep: str,
    current_user: UserProfile = Depends(get_current_user),
) -> UserProfile:
    """Authorize access to a school-scoped endpoint."""
    return ensure_school_access(current_user, codigo_inep)
