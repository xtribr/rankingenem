#!/usr/bin/env python3
"""
Migrate ENEM data from CSV to Supabase tables: schools + enem_results
"""

import csv
import os
from supabase import create_client

SUPABASE_URL = "https://rqzxcturezryjbwsptld.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

CSV_PATH = "enem-analytics/backend/data/enem_2018_2024_completo.csv"

# IBGE code (first 2 digits of codigo_inep) → UF
IBGE_TO_UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
    "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
    "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
    "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
    "52": "GO", "53": "DF",
}


def get_uf(codigo_inep: str) -> str:
    return IBGE_TO_UF.get(str(codigo_inep)[:2], "")


def safe_float(val):
    try:
        v = float(val)
        return v if v == v else None  # NaN check
    except (ValueError, TypeError):
        return None


def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def main():
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: Set SUPABASE_SERVICE_KEY environment variable")
        print("Get it from: Supabase Dashboard → Settings → API → service_role key")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Read CSV
    print(f"Reading {CSV_PATH}...")
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  Found {len(rows)} rows")

    # ── Step 1: Build schools master data ──
    print("\n── Step 1: Populating 'schools' table ──")
    schools = {}
    for row in rows:
        inep = str(row["codigo_inep"]).strip()
        if inep not in schools:
            schools[inep] = {
                "codigo_inep": inep,
                "nome": row["nome_escola"].strip(),
                "uf": get_uf(inep),
                "municipio": None,
                "dependencia": row.get("tipo_escola", "").strip() or None,
                "localizacao": row.get("localizacao", "").strip() or None,
                "is_active": True,
            }
        else:
            # Keep latest name
            schools[inep]["nome"] = row["nome_escola"].strip()

    school_list = list(schools.values())
    print(f"  {len(school_list)} unique schools")

    # Batch upsert schools (1000 at a time)
    batch_size = 500
    for i in range(0, len(school_list), batch_size):
        batch = school_list[i:i + batch_size]
        supabase.table("schools").upsert(batch, on_conflict="codigo_inep").execute()
        print(f"  Schools: {min(i + batch_size, len(school_list))}/{len(school_list)}")

    print(f"  ✓ Schools done!")

    # ── Step 2: Populate enem_results ──
    print("\n── Step 2: Populating 'enem_results' table ──")

    results = []
    for row in rows:
        inep = str(row["codigo_inep"]).strip()
        ano = safe_int(row["ano"])
        if not ano:
            continue

        results.append({
            "codigo_inep": inep,
            "ano": ano,
            "nome_escola": row["nome_escola"].strip(),
            "uf": get_uf(inep),
            "dependencia": row.get("tipo_escola", "").strip() or None,
            "media_cn": safe_float(row.get("nota_cn")),
            "media_ch": safe_float(row.get("nota_ch")),
            "media_lc": safe_float(row.get("nota_lc")),
            "media_mt": safe_float(row.get("nota_mt")),
            "media_redacao": safe_float(row.get("nota_redacao")),
            "media_geral": safe_float(row.get("nota_media")),
            "num_participantes": safe_int(row.get("qt_matriculas")),
            "ranking_nacional": safe_int(row.get("ranking_brasil")),
        })

    print(f"  {len(results)} result rows to insert")

    # Need unique constraint for upsert - check if it exists
    # Insert in batches
    for i in range(0, len(results), batch_size):
        batch = results[i:i + batch_size]
        supabase.table("enem_results").upsert(batch, on_conflict="codigo_inep,ano").execute()
        print(f"  Results: {min(i + batch_size, len(results))}/{len(results)}")

    print(f"  ✓ Results done!")

    # ── Step 3: Calculate ranking_uf ──
    print("\n── Step 3: Calculating ranking_uf via SQL ──")
    # This will be done via SQL directly

    print("\n✓ Migration complete!")
    print(f"  Schools: {len(school_list)}")
    print(f"  ENEM Results: {len(results)}")


if __name__ == "__main__":
    main()
