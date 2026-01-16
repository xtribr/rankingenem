#!/usr/bin/env python3
"""
Export users from Railway PostgreSQL to JSON for Supabase migration.

Usage:
    DATABASE_URL="postgresql://..." python scripts/export_users.py
"""

import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL environment variable not set")
    print("Usage: DATABASE_URL='postgresql://...' python scripts/export_users.py")
    exit(1)

# Handle Railway's postgres:// -> postgresql:// conversion
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


def export_users():
    """Export all users from Railway PostgreSQL to JSON file."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                id,
                codigo_inep,
                nome_escola,
                email,
                password_hash,
                is_active,
                is_admin,
                created_at,
                updated_at
            FROM users
            ORDER BY id
        """))

        users = []
        for row in result:
            users.append({
                "id": row.id,
                "codigo_inep": row.codigo_inep,
                "nome_escola": row.nome_escola,
                "email": row.email,
                "password_hash": row.password_hash,
                "is_active": row.is_active,
                "is_admin": row.is_admin,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            })

    # Save to JSON file
    output_file = "users_export.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(users)} users to {output_file}")

    # Print summary
    admins = sum(1 for u in users if u["is_admin"])
    active = sum(1 for u in users if u["is_active"])
    print(f"  - Admins: {admins}")
    print(f"  - Active: {active}")
    print(f"  - Inactive: {len(users) - active}")

    return users


if __name__ == "__main__":
    export_users()
