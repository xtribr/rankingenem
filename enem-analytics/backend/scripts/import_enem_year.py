#!/usr/bin/env python3
"""
Import ENEM Data for a Specific Year to Supabase

Usage:
    python import_enem_year.py --year 2025 --file /path/to/enem_2025.csv
    python import_enem_year.py --year 2025 --file /path/to/enem_2025.csv --dry-run
"""

import os
import sys
import argparse
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://rqzxcturezryjbwsptld.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Expected columns mapping
COLUMN_MAPPING = {
    # Source column -> Target column
    "CO_ENTIDADE": "codigo_inep",
    "NO_ENTIDADE": "nome_escola",
    "SG_UF": "uf",
    "NO_MUNICIPIO": "municipio",
    "TP_DEPENDENCIA_ADM": "dependencia",
    "NU_MEDIA_CN": "media_cn",
    "NU_MEDIA_CH": "media_ch",
    "NU_MEDIA_LC": "media_lc",
    "NU_MEDIA_MT": "media_mt",
    "NU_MEDIA_RED": "media_redacao",
    "NU_PARTICIPANTES": "num_participantes",
    "NU_TAXA_PARTICIPACAO": "taxa_participacao",
}

DEPENDENCIA_MAP = {
    1: "Federal",
    2: "Estadual",
    3: "Municipal",
    4: "Privada",
}


def get_supabase_client():
    """Initialize Supabase client."""
    if not SUPABASE_SERVICE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_KEY not found. "
            "Set it as environment variable or in .env file."
        )
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_csv(file_path: str) -> pd.DataFrame:
    """Load and validate CSV file."""
    print(f"📂 Loading: {file_path}")

    # Try different encodings
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(file_path, encoding=encoding, sep=";", low_memory=False)
            print(f"   Encoding: {encoding}")
            break
        except UnicodeDecodeError:
            continue
    else:
        # Try comma separator
        df = pd.read_csv(file_path, encoding="utf-8", low_memory=False)

    print(f"   Rows: {len(df):,}")
    print(f"   Columns: {list(df.columns)[:10]}...")

    return df


def transform_data(df: pd.DataFrame, year: int) -> pd.DataFrame:
    """Transform CSV to match enem_results schema."""
    print("\n🔄 Transforming data...")

    # Check which columns exist
    available_cols = set(df.columns)
    mapping = {}

    for src, tgt in COLUMN_MAPPING.items():
        if src in available_cols:
            mapping[src] = tgt
        else:
            # Try lowercase
            src_lower = src.lower()
            if src_lower in available_cols:
                mapping[src_lower] = tgt

    print(f"   Mapped columns: {len(mapping)}")

    # Rename columns
    result = df.rename(columns=mapping)

    # Keep only mapped columns
    keep_cols = list(mapping.values())
    result = result[[c for c in keep_cols if c in result.columns]]

    # Add year
    result["ano"] = year

    # Convert codigo_inep to string with zero-padding
    if "codigo_inep" in result.columns:
        result["codigo_inep"] = result["codigo_inep"].astype(str).str.zfill(8)

    # Map dependencia
    if "dependencia" in result.columns:
        result["dependencia"] = result["dependencia"].map(DEPENDENCIA_MAP).fillna("Outro")

    # Calculate media_geral
    score_cols = ["media_cn", "media_ch", "media_lc", "media_mt"]
    if all(c in result.columns for c in score_cols):
        result["media_geral"] = result[score_cols].mean(axis=1).round(2)

    # Clean numeric columns
    numeric_cols = ["media_cn", "media_ch", "media_lc", "media_mt",
                    "media_redacao", "media_geral", "num_participantes", "taxa_participacao"]
    for col in numeric_cols:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce")

    # Remove rows without codigo_inep
    result = result.dropna(subset=["codigo_inep"])

    print(f"   Result rows: {len(result):,}")
    print(f"   Result columns: {list(result.columns)}")

    return result


def calculate_rankings(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate national and state rankings."""
    print("\n📊 Calculating rankings...")

    # National ranking
    df = df.sort_values("media_geral", ascending=False, na_position="last")
    df["ranking_nacional"] = range(1, len(df) + 1)

    # State ranking
    df["ranking_uf"] = df.groupby("uf")["media_geral"].rank(
        ascending=False, method="min", na_option="bottom"
    ).astype(int)

    print(f"   Rankings calculated for {len(df):,} schools")

    return df


def upload_to_supabase(
    df: pd.DataFrame,
    dry_run: bool = False,
    batch_size: int = 500
) -> dict:
    """Upload data to Supabase enem_results table."""
    print("\n📤 Uploading to Supabase...")

    if dry_run:
        print("   [DRY RUN] Would upload:")
        print(df.head())
        return {"uploaded": 0, "errors": 0, "dry_run": True}

    supabase = get_supabase_client()

    # Convert to records
    records = df.to_dict(orient="records")

    # Clean NaN values
    for record in records:
        for key, value in list(record.items()):
            if pd.isna(value):
                record[key] = None

    uploaded = 0
    errors = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]

        try:
            result = supabase.table("enem_results").upsert(
                batch,
                on_conflict="codigo_inep,ano"
            ).execute()

            uploaded += len(batch)
            pct = (i + len(batch)) / len(records) * 100
            print(f"   ✓ Batch {i // batch_size + 1}: {uploaded:,}/{len(records):,} ({pct:.1f}%)")

        except Exception as e:
            errors += 1
            print(f"   ✗ Batch {i // batch_size + 1} failed: {e}")

    return {"uploaded": uploaded, "errors": errors}


def refresh_views(dry_run: bool = False):
    """Refresh materialized views."""
    print("\n🔄 Refreshing materialized views...")

    if dry_run:
        print("   [DRY RUN] Would refresh views")
        return

    supabase = get_supabase_client()

    try:
        supabase.rpc("refresh_materialized_views").execute()
        print("   ✓ Views refreshed")
    except Exception as e:
        print(f"   ⚠ Could not refresh views: {e}")
        print("     Run manually: SELECT refresh_materialized_views();")


def verify_import(year: int, dry_run: bool = False):
    """Verify the import."""
    print("\n🔍 Verifying import...")

    if dry_run:
        print("   [DRY RUN] Skipping verification")
        return

    supabase = get_supabase_client()

    # Count records
    result = supabase.table("enem_results")\
        .select("*", count="exact")\
        .eq("ano", year)\
        .limit(1)\
        .execute()

    print(f"   Records for {year}: {result.count:,}")

    # Top 5 schools
    result = supabase.table("enem_results")\
        .select("codigo_inep, nome_escola, uf, media_geral, ranking_nacional")\
        .eq("ano", year)\
        .order("ranking_nacional")\
        .limit(5)\
        .execute()

    print(f"\n   Top 5 schools ({year}):")
    for i, r in enumerate(result.data, 1):
        print(f"   {i}. {r['nome_escola'][:40]} ({r['uf']}) - {r['media_geral']:.1f}")


def main():
    parser = argparse.ArgumentParser(description="Import ENEM data to Supabase")
    parser.add_argument("--year", type=int, required=True, help="ENEM year (e.g., 2025)")
    parser.add_argument("--file", type=str, required=True, help="Path to CSV file")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without uploading")
    parser.add_argument("--batch-size", type=int, default=500, help="Upload batch size")

    args = parser.parse_args()

    print("=" * 60)
    print(f"IMPORT ENEM {args.year} DATA")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"File: {args.file}")
    print(f"Dry run: {args.dry_run}")
    print()

    # Load CSV
    df = load_csv(args.file)

    # Transform
    df = transform_data(df, args.year)

    # Calculate rankings
    df = calculate_rankings(df)

    # Upload
    result = upload_to_supabase(df, dry_run=args.dry_run, batch_size=args.batch_size)

    # Refresh views
    refresh_views(dry_run=args.dry_run)

    # Verify
    verify_import(args.year, dry_run=args.dry_run)

    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"   Uploaded: {result['uploaded']:,}")
    print(f"   Errors: {result['errors']}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
