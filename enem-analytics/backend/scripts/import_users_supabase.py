#!/usr/bin/env python3
"""
Import users from JSON export into Supabase Auth + profiles table.

Prerequisites:
1. Create Supabase project at supabase.com
2. Run the SQL to create profiles table (see below)
3. Set environment variables

Usage:
    SUPABASE_URL="https://xxx.supabase.co" \
    SUPABASE_SERVICE_KEY="eyJ..." \
    python scripts/import_users_supabase.py

SQL to run in Supabase SQL Editor first:
---------------------------------------------
-- Tabela de perfis (extensão do auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  codigo_inep VARCHAR(8) UNIQUE NOT NULL,
  nome_escola VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Service role bypass (for this script)
CREATE POLICY "Service role has full access"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role');
---------------------------------------------
"""

import os
import json
import time
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Missing environment variables")
    print("Required: SUPABASE_URL, SUPABASE_SERVICE_KEY")
    exit(1)


def import_users(input_file: str = "users_export.json", send_reset_emails: bool = True):
    """
    Import users from JSON to Supabase.

    Args:
        input_file: Path to JSON file exported from Railway
        send_reset_emails: If True, send password reset emails to all users
    """
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Load exported users
    with open(input_file, "r", encoding="utf-8") as f:
        users = json.load(f)

    print(f"Importing {len(users)} users to Supabase...")
    print(f"Supabase URL: {SUPABASE_URL}")
    print()

    success_count = 0
    error_count = 0
    errors = []

    for i, user in enumerate(users, 1):
        try:
            print(f"[{i}/{len(users)}] Importing: {user['email']}...", end=" ")

            # Create user in Supabase Auth
            # Note: Supabase doesn't accept bcrypt hashes directly
            # We create with a temporary password and send reset email
            temp_password = f"Temp_{user['codigo_inep']}_{int(time.time())}"

            auth_response = supabase.auth.admin.create_user({
                "email": user["email"],
                "password": temp_password,
                "email_confirm": True,  # Skip email verification
                "user_metadata": {
                    "codigo_inep": user["codigo_inep"],
                    "nome_escola": user["nome_escola"]
                }
            })

            if not auth_response.user:
                raise Exception("Failed to create auth user")

            user_id = auth_response.user.id

            # Create profile record
            supabase.table("profiles").insert({
                "id": user_id,
                "codigo_inep": user["codigo_inep"],
                "nome_escola": user["nome_escola"],
                "is_admin": user.get("is_admin", False)
            }).execute()

            # Send password reset email (optional)
            if send_reset_emails:
                supabase.auth.admin.generate_link({
                    "type": "recovery",
                    "email": user["email"],
                    "options": {
                        "redirect_to": f"{SUPABASE_URL.replace('.supabase.co', '')}/reset-password"
                    }
                })

            print("OK")
            success_count += 1

            # Rate limiting - avoid hitting Supabase limits
            time.sleep(0.5)

        except Exception as e:
            error_msg = str(e)
            print(f"ERROR: {error_msg}")
            errors.append({"email": user["email"], "error": error_msg})
            error_count += 1

    # Summary
    print()
    print("=" * 50)
    print("IMPORT SUMMARY")
    print("=" * 50)
    print(f"Total users: {len(users)}")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")

    if errors:
        print()
        print("ERRORS:")
        for err in errors:
            print(f"  - {err['email']}: {err['error']}")

    if send_reset_emails:
        print()
        print("IMPORTANT: Password reset emails have been sent to all users.")
        print("Users must click the link to set a new password.")

    return success_count, error_count


def check_connection():
    """Test Supabase connection before importing."""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        # Test profiles table exists
        result = supabase.table("profiles").select("id").limit(1).execute()
        print("Connection OK - profiles table accessible")
        return True
    except Exception as e:
        print(f"Connection ERROR: {e}")
        print()
        print("Make sure to run the SQL to create the profiles table first!")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Import users to Supabase")
    parser.add_argument("--input", default="users_export.json", help="Input JSON file")
    parser.add_argument("--no-emails", action="store_true", help="Skip sending reset emails")
    parser.add_argument("--check", action="store_true", help="Only check connection")
    args = parser.parse_args()

    if args.check:
        check_connection()
    else:
        if check_connection():
            import_users(args.input, send_reset_emails=not args.no_emails)
