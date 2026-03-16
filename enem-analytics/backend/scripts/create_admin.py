#!/usr/bin/env python3
"""Create the initial admin user in Supabase Auth + profiles."""

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / ".env")

from api.auth.supabase_service import get_supabase  # noqa: E402

ADMIN_INEP = "00000000"


def create_admin(email: str, password: str, nome: str = "Administrador X-TRI") -> None:
    """Create or update the bootstrap admin user in Supabase."""
    supabase = get_supabase()

    existing = (
        supabase.table("profiles")
        .select("id, codigo_inep, nome_escola, is_admin")
        .eq("codigo_inep", ADMIN_INEP)
        .limit(1)
        .execute()
    )

    if existing.data:
        print(f"Já existe um perfil admin bootstrap com INEP {ADMIN_INEP}.")
        print("Ajuste o usuário pelo painel admin ou diretamente no Supabase.")
        return

    try:
        auth_response = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "codigo_inep": ADMIN_INEP,
                    "nome_escola": nome,
                    "is_admin": True,
                },
            }
        )
    except Exception as exc:
        print(f"Erro ao criar usuário no Supabase Auth: {exc}")
        sys.exit(1)

    if not auth_response.user:
        print("Supabase Auth não retornou o usuário criado.")
        sys.exit(1)

    user_id = auth_response.user.id

    try:
        supabase.table("profiles").insert(
            {
                "id": user_id,
                "codigo_inep": ADMIN_INEP,
                "nome_escola": nome,
                "is_admin": True,
                "is_active": True,
            }
        ).execute()
    except Exception as exc:
        print(f"Erro ao criar perfil admin: {exc}")
        print(f"Usuário auth criado com id {user_id}. Remova-o manualmente se necessário.")
        sys.exit(1)

    print(f"Admin criado com sucesso: {email}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python scripts/create_admin.py <email> <senha> [nome]")
        print("Exemplo: python scripts/create_admin.py admin@xtri.online senha123 'Admin X-TRI'")
        sys.exit(1)

    create_admin(
        email=sys.argv[1],
        password=sys.argv[2],
        nome=sys.argv[3] if len(sys.argv) > 3 else "Administrador X-TRI",
    )
