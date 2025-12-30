"""
Import School Skills from CSV to Supabase

Use this script when new ENEM data arrives (e.g., 2025 in August).
The CSV should have columns: codigo_inep, nome_escola, area, skill_num, performance, descricao

Usage:
    python scripts/import_school_skills_csv.py --file data/school_skills_2025.csv --year 2025
"""

import argparse
import os
import json
import pandas as pd
from pathlib import Path

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rqzxcturezryjbwsptld.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def get_supabase_client():
    """Initialize Supabase client"""
    if not SUPABASE_SERVICE_KEY:
        # Try to load from .env file
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.startswith("SUPABASE_SERVICE_KEY="):
                        key = line.split("=", 1)[1].strip().strip('"\'')
                        break
        else:
            raise RuntimeError("SUPABASE_SERVICE_KEY not found")
    else:
        key = SUPABASE_SERVICE_KEY

    from supabase import create_client
    return create_client(SUPABASE_URL, key)


def import_csv(file_path: str, year: int, dry_run: bool = False):
    """
    Import school skills from CSV to Supabase.

    Args:
        file_path: Path to CSV file
        year: Year of the data (e.g., 2025)
        dry_run: If True, only validate without inserting
    """
    print("=" * 60)
    print(f"IMPORT SCHOOL SKILLS - {year}")
    print("=" * 60)

    # Load CSV
    print(f"\n1. Loading CSV: {file_path}")
    df = pd.read_csv(file_path)
    print(f"   Rows: {len(df):,}")
    print(f"   Columns: {list(df.columns)}")

    # Validate required columns
    required = ['codigo_inep', 'area', 'skill_num', 'performance']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Validate data
    print(f"\n2. Validating data...")

    # Check areas
    valid_areas = {'CN', 'CH', 'LC', 'MT'}
    invalid_areas = set(df['area'].unique()) - valid_areas
    if invalid_areas:
        raise ValueError(f"Invalid areas found: {invalid_areas}")
    print(f"   Areas: {sorted(df['area'].unique())}")

    # Check skill_num range
    if df['skill_num'].min() < 1 or df['skill_num'].max() > 30:
        raise ValueError(f"skill_num out of range: {df['skill_num'].min()}-{df['skill_num'].max()}")
    print(f"   skill_num range: {df['skill_num'].min()}-{df['skill_num'].max()}")

    # Check performance range
    if df['performance'].min() < 0 or df['performance'].max() > 100:
        print(f"   WARNING: performance out of 0-100 range: {df['performance'].min()}-{df['performance'].max()}")
    print(f"   performance range: {df['performance'].min():.2f}-{df['performance'].max():.2f}")

    # Count unique schools
    unique_schools = df['codigo_inep'].nunique()
    print(f"   Unique schools: {unique_schools:,}")

    # Deduplicate
    print(f"\n3. Deduplicating...")
    df_dedup = df.drop_duplicates(subset=['codigo_inep', 'area', 'skill_num'])
    removed = len(df) - len(df_dedup)
    print(f"   Removed {removed:,} duplicates")
    print(f"   Final records: {len(df_dedup):,}")

    if dry_run:
        print(f"\n[DRY RUN] Would insert {len(df_dedup):,} records for year {year}")
        return

    # Upload to Supabase
    print(f"\n4. Uploading to Supabase...")
    supabase = get_supabase_client()

    # Prepare records
    records = []
    for _, row in df_dedup.iterrows():
        records.append({
            'codigo_inep': str(row['codigo_inep']),
            'nome_escola': row.get('nome_escola', ''),
            'area': row['area'],
            'skill_num': int(row['skill_num']),
            'performance': float(row['performance']),
            'descricao': row.get('descricao', f"Habilidade {row['skill_num']}"),
            'ano': year
        })

    # Upload in batches
    batch_size = 1000
    total = len(records)
    uploaded = 0

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]

        result = supabase.table('school_skills').upsert(
            batch,
            on_conflict='codigo_inep,area,skill_num,ano'
        ).execute()

        uploaded += len(batch)
        pct = uploaded / total * 100
        print(f"   Progress: {uploaded:,}/{total:,} ({pct:.1f}%)")

    print(f"\n" + "=" * 60)
    print(f"IMPORT COMPLETE")
    print("=" * 60)
    print(f"   Year: {year}")
    print(f"   Records: {uploaded:,}")
    print(f"   Schools: {unique_schools:,}")


def main():
    parser = argparse.ArgumentParser(description='Import school skills from CSV to Supabase')
    parser.add_argument('--file', '-f', required=True, help='Path to CSV file')
    parser.add_argument('--year', '-y', type=int, required=True, help='Year of the data')
    parser.add_argument('--dry-run', action='store_true', help='Validate only, do not insert')

    args = parser.parse_args()

    import_csv(args.file, args.year, args.dry_run)


if __name__ == "__main__":
    main()
