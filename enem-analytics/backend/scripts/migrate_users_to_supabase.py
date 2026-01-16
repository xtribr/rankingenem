#!/usr/bin/env python3
"""
Migrate users from Railway PostgreSQL to Supabase Auth + Profiles

Usage:
    DATABASE_URL="postgresql://..." python scripts/migrate_users_to_supabase.py

The script will:
1. Export users from Railway PostgreSQL
2. Create users in Supabase Auth (with temporary passwords)
3. Create profiles in the profiles table
4. Optionally send password reset emails
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Check for required env vars
RAILWAY_DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not RAILWAY_DATABASE_URL:
    print("Error: DATABASE_URL not set. Set it to your Railway PostgreSQL URL.")
    print("Example: DATABASE_URL='postgresql://user:pass@host:port/db' python scripts/migrate_users_to_supabase.py")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

from sqlalchemy import create_engine, text
from supabase import create_client
import secrets
import string


def generate_temp_password(length=16):
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def export_users_from_railway():
    """Export users from Railway PostgreSQL"""
    print("\n📤 Exporting users from Railway...")

    engine = create_engine(RAILWAY_DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, codigo_inep, nome_escola, email, is_active, is_admin, created_at
            FROM users
            ORDER BY id
        """))

        users = []
        for row in result:
            users.append({
                "id": row[0],
                "codigo_inep": row[1],
                "nome_escola": row[2],
                "email": row[3],
                "is_active": row[4],
                "is_admin": row[5],
                "created_at": str(row[6]) if row[6] else None
            })

    print(f"   Found {len(users)} users")
    return users


def import_users_to_supabase(users, send_reset_emails=False):
    """Import users to Supabase Auth and create profiles"""
    print("\n📥 Importing users to Supabase...")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    success_count = 0
    error_count = 0
    skipped_count = 0

    for user in users:
        try:
            email = user["email"]

            # Check if user already exists in Supabase
            existing = supabase.table("profiles").select("id").eq("codigo_inep", user["codigo_inep"]).execute()
            if existing.data:
                print(f"   ⏭️  Skipping {email} (already exists)")
                skipped_count += 1
                continue

            # Generate temporary password
            temp_password = generate_temp_password()

            # Create user in Supabase Auth
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": temp_password,
                "email_confirm": True,  # Skip email verification
                "user_metadata": {
                    "codigo_inep": user["codigo_inep"],
                    "nome_escola": user["nome_escola"]
                }
            })

            if not auth_response.user:
                print(f"   ❌ Failed to create auth user: {email}")
                error_count += 1
                continue

            auth_user_id = auth_response.user.id

            # Create profile in profiles table
            supabase.table("profiles").insert({
                "id": auth_user_id,
                "codigo_inep": user["codigo_inep"],
                "nome_escola": user["nome_escola"],
                "is_admin": user["is_admin"] or False
            }).execute()

            print(f"   ✅ Migrated: {email} ({user['codigo_inep']})")
            success_count += 1

            # Optionally send password reset email
            if send_reset_emails:
                try:
                    supabase.auth.admin.generate_link({
                        "type": "recovery",
                        "email": email
                    })
                    print(f"      📧 Password reset email sent")
                except Exception as e:
                    print(f"      ⚠️  Could not send reset email: {e}")

        except Exception as e:
            print(f"   ❌ Error migrating {user.get('email', 'unknown')}: {e}")
            error_count += 1

    return success_count, error_count, skipped_count


def main():
    print("=" * 60)
    print("🚀 Railway → Supabase User Migration")
    print("=" * 60)

    # Export users from Railway
    users = export_users_from_railway()

    if not users:
        print("\n⚠️  No users found in Railway database")
        return

    # Show preview
    print("\n📋 Users to migrate:")
    for user in users[:5]:
        admin_badge = " [ADMIN]" if user["is_admin"] else ""
        print(f"   - {user['email']} ({user['codigo_inep']}){admin_badge}")
    if len(users) > 5:
        print(f"   ... and {len(users) - 5} more")

    # Confirm migration
    print(f"\n⚠️  This will create {len(users)} users in Supabase.")
    print("   Users will need to reset their passwords after migration.")

    confirm = input("\nProceed with migration? (yes/no): ")
    if confirm.lower() != "yes":
        print("Migration cancelled.")
        return

    # Ask about password reset emails
    send_emails = input("Send password reset emails to users? (yes/no): ")
    send_reset_emails = send_emails.lower() == "yes"

    # Import to Supabase
    success, errors, skipped = import_users_to_supabase(users, send_reset_emails)

    # Summary
    print("\n" + "=" * 60)
    print("📊 Migration Summary")
    print("=" * 60)
    print(f"   ✅ Successfully migrated: {success}")
    print(f"   ⏭️  Skipped (already exist): {skipped}")
    print(f"   ❌ Errors: {errors}")
    print("=" * 60)

    if success > 0 and not send_reset_emails:
        print("\n📧 Don't forget to notify users to reset their passwords!")
        print("   They can use the 'Forgot Password' link on the login page.")


if __name__ == "__main__":
    main()
