"""Authentication module - Supabase Auth"""
from .router import router

# Use Supabase auth dependencies
from .supabase_dependencies import get_current_user, get_current_admin, get_optional_user

__all__ = ["router", "get_current_user", "get_current_admin", "get_optional_user"]
