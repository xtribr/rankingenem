"""Authentication module - Supabase Auth"""
from .router import router

# Use Supabase auth dependencies
from .supabase_dependencies import get_current_user, get_current_admin, get_optional_user
from .authorization import ensure_school_access, get_authorized_school_user

__all__ = [
    "router",
    "get_current_user",
    "get_current_admin",
    "get_optional_user",
    "ensure_school_access",
    "get_authorized_school_user",
]
