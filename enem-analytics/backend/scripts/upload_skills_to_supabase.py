"""
Upload School Skills Data to Supabase
Creates table and uploads extracted skills data
"""

import os
import json
import pandas as pd
from pathlib import Path
from datetime import datetime

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rqzxcturezryjbwsptld.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    # Try to load from .env file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith("SUPABASE_SERVICE_KEY="):
                    SUPABASE_SERVICE_KEY = line.split("=", 1)[1].strip().strip('"\'')
                    break

if not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY not found in environment or .env file")
    exit(1)

# Data file
DATA_PATH = Path(__file__).parent.parent / "data" / "school_skills_2024.json"


def get_supabase_client():
    """Initialize Supabase client"""
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def create_table_sql():
    """SQL to create the school_skills table"""
    return """
-- Drop existing table if needed
DROP TABLE IF EXISTS public.school_skills;

-- Create school_skills table
CREATE TABLE public.school_skills (
    id SERIAL PRIMARY KEY,
    codigo_inep VARCHAR(8) NOT NULL,
    nome_escola VARCHAR(255) NOT NULL,
    area VARCHAR(2) NOT NULL CHECK (area IN ('CN', 'CH', 'LC', 'MT')),
    skill_num INTEGER NOT NULL CHECK (skill_num BETWEEN 1 AND 30),
    performance DECIMAL(5,2) NOT NULL CHECK (performance BETWEEN 0 AND 100),
    descricao TEXT,
    ano INTEGER NOT NULL DEFAULT 2024,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint to prevent duplicates
    UNIQUE(codigo_inep, area, skill_num, ano)
);

-- Create indexes for fast queries
CREATE INDEX idx_school_skills_inep ON public.school_skills(codigo_inep);
CREATE INDEX idx_school_skills_area ON public.school_skills(area);
CREATE INDEX idx_school_skills_inep_area ON public.school_skills(codigo_inep, area);
CREATE INDEX idx_school_skills_performance ON public.school_skills(performance);

-- Enable RLS
ALTER TABLE public.school_skills ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required for reading)
CREATE POLICY "Public read access for school_skills"
ON public.school_skills FOR SELECT
USING (true);

-- Service role can insert/update
CREATE POLICY "Service role full access for school_skills"
ON public.school_skills FOR ALL
USING (auth.role() = 'service_role');

-- Grant access
GRANT SELECT ON public.school_skills TO anon;
GRANT SELECT ON public.school_skills TO authenticated;
GRANT ALL ON public.school_skills TO service_role;
GRANT USAGE, SELECT ON SEQUENCE school_skills_id_seq TO anon, authenticated, service_role;
"""


def upload_data():
    """Upload skills data to Supabase"""
    print("=" * 60)
    print("UPLOAD SCHOOL SKILLS TO SUPABASE")
    print("=" * 60)
    print(f"Início: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Load data
    print("📂 Loading data from JSON...")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        records = json.load(f)
    print(f"   Loaded {len(records):,} records")

    # Initialize Supabase
    print("\n🔌 Connecting to Supabase...")
    supabase = get_supabase_client()
    print("   Connected!")

    # First, print the SQL to create the table (user needs to run this manually)
    print("\n" + "=" * 60)
    print("⚠️  EXECUTE THIS SQL IN SUPABASE SQL EDITOR FIRST:")
    print("=" * 60)
    print(create_table_sql())
    print("=" * 60)

    input("\n>>> Press ENTER after running the SQL in Supabase SQL Editor...")

    # Upload in batches
    print("\n📤 Uploading data in batches...")
    batch_size = 1000
    total = len(records)
    uploaded = 0
    errors = 0

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]

        # Prepare batch with ano field
        batch_with_ano = [
            {
                "codigo_inep": r["codigo_inep"],
                "nome_escola": r["nome_escola"],
                "area": r["area"],
                "skill_num": r["skill_num"],
                "performance": r["performance"],
                "descricao": r["descricao"],
                "ano": 2024
            }
            for r in batch
        ]

        try:
            result = supabase.table("school_skills").upsert(
                batch_with_ano,
                on_conflict="codigo_inep,area,skill_num,ano"
            ).execute()
            uploaded += len(batch)
            pct = (i + len(batch)) / total * 100
            print(f"   ✓ Batch {i // batch_size + 1}: {uploaded:,}/{total:,} ({pct:.1f}%)")
        except Exception as e:
            errors += 1
            print(f"   ❌ Batch {i // batch_size + 1} failed: {e}")

    print("\n" + "=" * 60)
    print("UPLOAD CONCLUÍDO")
    print("=" * 60)
    print(f"   ✓ Uploaded: {uploaded:,} records")
    print(f"   ✗ Errors: {errors}")
    print(f"   Fim: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def verify_upload():
    """Verify the upload by querying Supabase"""
    print("\n🔍 Verifying upload...")
    supabase = get_supabase_client()

    # Count total records
    result = supabase.table("school_skills").select("*", count="exact").limit(1).execute()
    print(f"   Total records in Supabase: {result.count:,}")

    # Get unique schools
    result = supabase.rpc("get_unique_schools_count").execute()
    if hasattr(result, 'data'):
        print(f"   Unique schools: {result.data}")

    # Sample query
    result = supabase.table("school_skills").select("*").eq("codigo_inep", "11000058").limit(5).execute()
    print(f"\n   Sample data for escola 11000058:")
    for row in result.data[:3]:
        print(f"      {row['area']} H{row['skill_num']:02d}: {row['performance']}%")


if __name__ == "__main__":
    upload_data()
    verify_upload()
