"""
Supabase-based data store for ENEM school queries.
Replaces DuckDB + CSV - data lives in Supabase Postgres.
"""

import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Any

from supabase import create_client, Client

from data.year_resolver import find_latest_enem_results_file, get_file_year

logger = logging.getLogger(__name__)

_client: Optional[Client] = None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_BACKEND_DATA_DIR = Path(__file__).resolve().parent


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def init_database():
    """Verify Supabase connection on startup"""
    client = get_client()
    result = client.table("enem_results").select("count", count="exact").limit(1).execute()
    print(f"Supabase connected: {result.count:,} enem_results records")


def _fallback_latest_year_from_files() -> Optional[int]:
    latest_file = find_latest_enem_results_file(_BACKEND_DATA_DIR)
    if latest_file is None:
        return None
    return get_file_year(latest_file)


def get_latest_year() -> int:
    client = get_client()
    result = client.table("enem_results").select("ano").order("ano", desc=True).limit(1).execute()
    if result.data:
        return int(result.data[0]["ano"])

    file_year = _fallback_latest_year_from_files()
    if file_year is not None:
        logger.warning(
            "Supabase enem_results empty; falling back to latest file year=%s", file_year
        )
        return file_year

    raise RuntimeError(
        "Unable to determine latest ENEM year: Supabase empty and no data files found"
    )


def list_schools(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    localizacao: Optional[str] = None,
    porte: Optional[int] = None,
    ano: Optional[int] = None,
    order_by: str = "ranking",
    order: str = "asc"
) -> List[Dict[str, Any]]:
    client = get_client()
    target_ano = ano or get_latest_year()
    offset = (page - 1) * limit

    query = client.table("enem_results").select(
        "codigo_inep, nome_escola, uf, dependencia, media_geral, "
        "ranking_nacional, ranking_uf, num_participantes, "
        "localizacao, porte, porte_label, anos_participacao"
    ).eq("ano", target_ano)

    if search:
        query = query.or_(f"nome_escola.ilike.%{search}%,codigo_inep.ilike.%{search}%")
    if uf:
        query = query.eq("uf", uf.upper())
    if tipo_escola:
        query = query.eq("dependencia", tipo_escola)
    if localizacao:
        query = query.eq("localizacao", localizacao)
    if porte is not None:
        query = query.eq("porte", porte)

    if order_by == "ranking":
        query = query.not_.is_("ranking_nacional", "null")
        query = query.order("ranking_nacional", desc=(order == "desc"))
    elif order_by == "nota":
        query = query.order("media_geral", desc=(order == "desc"))
    else:
        query = query.order("nome_escola", desc=(order == "desc"))

    query = query.range(offset, offset + limit - 1)
    result = query.execute()

    schools = []
    for r in result.data:
        schools.append({
            "codigo_inep": r["codigo_inep"],
            "nome_escola": r["nome_escola"],
            "uf": r.get("uf"),
            "tipo_escola": r.get("dependencia"),
            "localizacao": r.get("localizacao"),
            "porte": r.get("porte"),
            "porte_label": r.get("porte_label"),
            "qt_matriculas": r.get("num_participantes"),
            "ultimo_ranking": r.get("ranking_nacional"),
            "ultima_nota": float(r["media_geral"]) if r.get("media_geral") else None,
            "anos_participacao": r.get("anos_participacao"),
        })
    return schools


def get_top_schools(
    limit: int = 10,
    ano: Optional[int] = None,
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    localizacao: Optional[str] = None,
    porte: Optional[int] = None
) -> Dict[str, Any]:
    client = get_client()
    target_ano = ano or get_latest_year()

    query = client.table("enem_results").select(
        "ranking_nacional, codigo_inep, nome_escola, uf, dependencia, "
        "num_participantes, media_geral, media_cn, media_ch, media_lc, "
        "media_mt, media_redacao, localizacao, porte, porte_label, "
        "desempenho_habilidades, competencia_redacao_media"
    ).eq("ano", target_ano).not_.is_("ranking_nacional", "null")

    if uf:
        query = query.eq("uf", uf.upper())
    if tipo_escola:
        query = query.eq("dependencia", tipo_escola)
    if localizacao:
        query = query.eq("localizacao", localizacao)
    if porte is not None:
        query = query.eq("porte", porte)

    query = query.order("ranking_nacional").limit(limit)
    result = query.execute()

    # Bulk-fetch history for the returned schools so the frontend can draw
    # sparklines without firing N round-trips per dashboard load.
    inep_codes = [r["codigo_inep"] for r in result.data]
    history_by_inep: Dict[str, List[Dict[str, Any]]] = {}
    if inep_codes:
        hist_result = (
            client.table("enem_results")
            .select("codigo_inep, ano, media_geral")
            .in_("codigo_inep", inep_codes)
            .order("ano")
            .execute()
        )
        for row in hist_result.data or []:
            if row.get("media_geral") is None:
                continue
            history_by_inep.setdefault(row["codigo_inep"], []).append({
                "ano": int(row["ano"]),
                "nota_media": float(row["media_geral"]),
            })

    schools = []
    for r in result.data:
        schools.append({
            "ranking": r["ranking_nacional"],
            "codigo_inep": r["codigo_inep"],
            "nome_escola": r["nome_escola"],
            "uf": r.get("uf"),
            "tipo_escola": r.get("dependencia"),
            "localizacao": r.get("localizacao"),
            "porte": r.get("porte"),
            "porte_label": r.get("porte_label"),
            "qt_matriculas": r.get("num_participantes"),
            "nota_media": float(r["media_geral"]) if r.get("media_geral") else None,
            "nota_cn": float(r["media_cn"]) if r.get("media_cn") else None,
            "nota_ch": float(r["media_ch"]) if r.get("media_ch") else None,
            "nota_lc": float(r["media_lc"]) if r.get("media_lc") else None,
            "nota_mt": float(r["media_mt"]) if r.get("media_mt") else None,
            "nota_redacao": float(r["media_redacao"]) if r.get("media_redacao") else None,
            "desempenho_habilidades": float(r["desempenho_habilidades"]) if r.get("desempenho_habilidades") is not None else None,
            "competencia_redacao_media": float(r["competencia_redacao_media"]) if r.get("competencia_redacao_media") is not None else None,
            "history": history_by_inep.get(r["codigo_inep"], []),
        })

    return {
        "ano": target_ano,
        "total": len(schools),
        "schools": schools
    }


def search_schools(q: str, limit: int = 20) -> List[Dict[str, Any]]:
    client = get_client()

    result = client.table("enem_results").select(
        "codigo_inep, nome_escola, uf, ano"
    ).or_(
        f"nome_escola.ilike.%{q}%,codigo_inep.ilike.%{q}%"
    ).order("ano", desc=True).limit(limit * 5).execute()

    # Deduplicate: keep latest year per school
    seen = {}
    for r in result.data:
        inep = r["codigo_inep"]
        if inep not in seen:
            seen[inep] = {
                "codigo_inep": inep,
                "nome_escola": r["nome_escola"],
                "uf": r.get("uf"),
                "ultimo_ano": r["ano"],
            }

    return list(seen.values())[:limit]


def get_school_detail(codigo_inep: str) -> Optional[Dict[str, Any]]:
    client = get_client()

    result = client.table("enem_results").select(
        "ano, media_cn, media_ch, media_lc, media_mt, media_redacao, "
        "media_geral, ranking_nacional, ranking_uf, nome_escola, uf, dependencia, "
        "desempenho_habilidades, competencia_redacao_media"
    ).eq("codigo_inep", codigo_inep).order("ano").execute()

    if not result.data:
        return None

    historico = []
    for r in result.data:
        historico.append({
            "ano": r["ano"],
            "nota_cn": float(r["media_cn"]) if r.get("media_cn") else None,
            "nota_ch": float(r["media_ch"]) if r.get("media_ch") else None,
            "nota_lc": float(r["media_lc"]) if r.get("media_lc") else None,
            "nota_mt": float(r["media_mt"]) if r.get("media_mt") else None,
            "nota_redacao": float(r["media_redacao"]) if r.get("media_redacao") else None,
            "nota_media": float(r["media_geral"]) if r.get("media_geral") else None,
            "ranking_brasil": r.get("ranking_nacional"),
            "ranking_uf": r.get("ranking_uf"),
            "desempenho_habilidades": float(r["desempenho_habilidades"]) if r.get("desempenho_habilidades") is not None else None,
            "competencia_redacao_media": float(r["competencia_redacao_media"]) if r.get("competencia_redacao_media") is not None else None,
        })

    latest = result.data[-1]

    # Trend calculation
    tendencia = None
    if len(historico) >= 2:
        recent = historico[-3:] if len(historico) >= 3 else historico
        if recent[0].get("nota_media") and recent[-1].get("nota_media"):
            diff = recent[-1]["nota_media"] - recent[0]["nota_media"]
            if diff > 10:
                tendencia = "subindo"
            elif diff < -10:
                tendencia = "descendo"
            else:
                tendencia = "estável"

    # Best year
    ranked = [h for h in historico if h.get("ranking_brasil")]
    best = min(ranked, key=lambda x: x["ranking_brasil"]) if ranked else None

    return {
        "codigo_inep": codigo_inep,
        "nome_escola": latest.get("nome_escola"),
        "uf": latest.get("uf"),
        "tipo_escola": latest.get("dependencia"),
        "historico": historico,
        "tendencia": tendencia,
        "melhor_ano": best["ano"] if best else None,
        "melhor_ranking": best["ranking_brasil"] if best else None,
    }


def get_stats() -> Dict[str, Any]:
    client = get_client()
    result = client.rpc("get_enem_stats", {}).execute()
    if result.data:
        return result.data
    return {
        "total_records": 0,
        "total_schools": 0,
        "years": [],
        "states": [],
        "avg_scores": {}
    }
