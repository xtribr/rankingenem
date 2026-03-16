"""
Supabase-based data store for ENEM school queries.
Replaces DuckDB + CSV - data lives in Supabase Postgres.
"""

import os
from typing import Optional, List, Dict, Any
from supabase import create_client, Client

_client: Optional[Client] = None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


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


def get_latest_year() -> int:
    client = get_client()
    result = client.table("enem_results").select("ano").order("ano", desc=True).limit(1).execute()
    return result.data[0]["ano"] if result.data else 2024


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
        "ranking_nacional, ranking_uf, num_participantes"
    ).eq("ano", target_ano)

    if search:
        query = query.or_(f"nome_escola.ilike.%{search}%,codigo_inep.ilike.%{search}%")
    if uf:
        query = query.eq("uf", uf.upper())
    if tipo_escola:
        query = query.eq("dependencia", tipo_escola)

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
            "localizacao": None,
            "porte": None,
            "porte_label": None,
            "qt_matriculas": r.get("num_participantes"),
            "ultimo_ranking": r.get("ranking_nacional"),
            "ultima_nota": float(r["media_geral"]) if r.get("media_geral") else None,
            "anos_participacao": None,
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
        "media_mt, media_redacao"
    ).eq("ano", target_ano).not_.is_("ranking_nacional", "null")

    if uf:
        query = query.eq("uf", uf.upper())
    if tipo_escola:
        query = query.eq("dependencia", tipo_escola)

    query = query.order("ranking_nacional").limit(limit)
    result = query.execute()

    schools = []
    for r in result.data:
        schools.append({
            "ranking": r["ranking_nacional"],
            "codigo_inep": r["codigo_inep"],
            "nome_escola": r["nome_escola"],
            "uf": r.get("uf"),
            "tipo_escola": r.get("dependencia"),
            "localizacao": None,
            "porte": None,
            "porte_label": None,
            "qt_matriculas": r.get("num_participantes"),
            "nota_media": float(r["media_geral"]) if r.get("media_geral") else None,
            "nota_cn": float(r["media_cn"]) if r.get("media_cn") else None,
            "nota_ch": float(r["media_ch"]) if r.get("media_ch") else None,
            "nota_lc": float(r["media_lc"]) if r.get("media_lc") else None,
            "nota_mt": float(r["media_mt"]) if r.get("media_mt") else None,
            "nota_redacao": float(r["media_redacao"]) if r.get("media_redacao") else None,
            "desempenho_habilidades": None,
            "competencia_redacao_media": None,
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
        "media_geral, ranking_nacional, ranking_uf, nome_escola, uf, dependencia"
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
            "desempenho_habilidades": None,
            "competencia_redacao_media": None,
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
