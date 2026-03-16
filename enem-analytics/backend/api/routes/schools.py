"""School endpoints for ENEM Analytics API."""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List, Dict
from pathlib import Path
from pydantic import BaseModel
import pandas as pd

from api.auth.authorization import get_authorized_school_user
from api.auth.supabase_dependencies import UserProfile, get_current_admin
from data.year_resolver import find_latest_skills_file, get_file_year

# Supabase-based data layer
from data.supabase_store import (
    list_schools as duckdb_list_schools,
    get_top_schools as duckdb_get_top_schools,
    search_schools as duckdb_search_schools,
    get_school_detail as duckdb_get_school_detail,
    get_stats as duckdb_get_stats,
)

router = APIRouter()

# Cache for skills data
_skills_df = None
_skills_year = None

# Skill descriptions (used for enriching data)
SKILL_DESCRIPTIONS = {
    "CN": {
        1: "Compreender fenômenos naturais usando conceitos científicos",
        2: "Associar sistemas físicos, químicos e biológicos a processos naturais",
        3: "Enfrentar situações-problema usando conhecimentos científicos",
        4: "Compreender o papel da evolução na diversidade biológica",
        5: "Avaliar o impacto de intervenções humanas no ambiente",
        6: "Interpretar experimentos científicos e seus resultados",
        7: "Analisar e compreender conceitos de genética e hereditariedade",
        8: "Compreender processos de transformação de energia",
        9: "Avaliar mudanças de estado físico e transformações químicas",
        10: "Compreender a dinâmica de ecossistemas e cadeias alimentares",
        11: "Analisar fenômenos eletromagnéticos e suas aplicações",
        12: "Compreender processos de obtenção de materiais e substâncias",
        13: "Avaliar propostas de intervenção no meio ambiente",
        14: "Compreender a célula como unidade básica da vida",
        15: "Analisar fenômenos ondulatórios e suas propriedades",
        16: "Compreender processos metabólicos e bioquímicos",
        17: "Avaliar aspectos quantitativos de transformações químicas",
        18: "Compreender movimento, forças e leis de Newton",
        19: "Analisar processos de nutrição e digestão",
        20: "Compreender o sistema nervoso e seus processos",
        21: "Analisar fenômenos térmicos e termodinâmicos",
        22: "Compreender ciclos biogeoquímicos",
        23: "Avaliar impactos ambientais de atividades humanas",
        24: "Compreender processos de reprodução e desenvolvimento",
        25: "Analisar a relação entre tecnologia e ciência",
        26: "Compreender o funcionamento do sistema imunológico",
        27: "Analisar doenças e medidas de prevenção",
        28: "Compreender a origem e evolução do universo",
        29: "Analisar o uso de recursos naturais e sustentabilidade",
        30: "Compreender processos de fotossíntese e respiração celular",
    },
    "CH": {
        1: "Compreender a produção e o papel histórico das instituições sociais",
        2: "Analisar a atuação dos movimentos sociais na transformação da realidade",
        3: "Compreender conflitos gerados pela diversidade cultural",
        4: "Avaliar relações de poder entre grupos sociais",
        5: "Identificar transformações territoriais e paisagens",
        6: "Compreender processos de formação do Estado brasileiro",
        7: "Analisar o papel da mídia na sociedade contemporânea",
        8: "Compreender fatores que contribuíram para revoluções históricas",
        9: "Analisar processos migratórios e seus impactos",
        10: "Compreender organizações políticas e sistemas de governo",
        11: "Analisar desigualdades sociais e seus determinantes",
        12: "Compreender processo de urbanização e problemas urbanos",
        13: "Avaliar impactos da globalização econômica e cultural",
        14: "Analisar formação e caracterização de blocos econômicos",
        15: "Compreender aspectos geográficos de conflitos contemporâneos",
        16: "Analisar processos de industrialização e impactos",
        17: "Compreender relações entre trabalho e sociedade",
        18: "Analisar períodos históricos do Brasil",
        19: "Compreender formação cultural brasileira e identidade nacional",
        20: "Avaliar propostas de intervenção em problemas sociais",
        21: "Compreender questões ambientais e desenvolvimento sustentável",
        22: "Analisar a questão agrária brasileira e conflitos no campo",
        23: "Compreender processos de colonização e descolonização",
        24: "Analisar aspectos do trabalho no mundo contemporâneo",
        25: "Compreender dinâmicas demográficas e suas consequências",
        26: "Analisar a expansão marítima e comercial europeia",
        27: "Compreender processos de independência na América",
        28: "Analisar regimes autoritários e processos de democratização",
        29: "Compreender a formação dos Estados nacionais",
        30: "Analisar movimentos culturais e artísticos ao longo da história",
    },
    "LC": {
        1: "Identificar diferentes linguagens e seus contextos de uso",
        2: "Reconhecer a função social de diferentes gêneros textuais",
        3: "Analisar relações entre textos e seus contextos",
        4: "Reconhecer posicionamentos ideológicos em textos",
        5: "Avaliar argumentos em textos de diferentes gêneros",
        6: "Compreender propostas de intervenção social através de textos",
        7: "Relacionar linguagens verbal e não verbal",
        8: "Reconhecer o uso de figuras de linguagem e seus efeitos",
        9: "Compreender variações linguísticas e seus contextos",
        10: "Analisar recursos expressivos das linguagens artísticas",
        11: "Reconhecer estratégias argumentativas em textos",
        12: "Compreender a função social da literatura",
        13: "Analisar aspectos formais e estruturais de textos",
        14: "Identificar elementos que concorrem para a progressão temática",
        15: "Estabelecer relações entre textos de diferentes gêneros",
        16: "Reconhecer procedimentos de convencimento em textos",
        17: "Analisar a produção artística como expressão cultural",
        18: "Compreender manifestações corporais e práticas esportivas",
        19: "Avaliar o papel da mídia na construção de realidades",
        20: "Analisar a função estética em produções culturais",
        21: "Compreender textos técnicos e científicos",
        22: "Reconhecer recursos de coesão e coerência textual",
        23: "Analisar aspectos da língua portuguesa em uso",
        24: "Compreender processos de formação de palavras",
        25: "Avaliar a adequação linguística em diferentes contextos",
        26: "Analisar produções culturais de diferentes épocas",
        27: "Compreender o papel da tecnologia na comunicação",
        28: "Reconhecer diferentes formas de organização textual",
        29: "Avaliar processos de criação artística e cultural",
        30: "Compreender relações intertextuais e suas funções",
    },
    "MT": {
        1: "Construir significados para números naturais, inteiros e racionais",
        2: "Utilizar conhecimentos geométricos na resolução de problemas",
        3: "Selecionar estratégias de resolução de problemas",
        4: "Analisar dados apresentados em gráficos e tabelas",
        5: "Avaliar propostas de intervenção usando conceitos matemáticos",
        6: "Interpretar informações em diferentes representações matemáticas",
        7: "Compreender o caráter aleatório de fenômenos naturais e sociais",
        8: "Resolver problemas envolvendo grandezas proporcionais",
        9: "Utilizar instrumentos de medida e escalas",
        10: "Analisar informações expressas em gráficos e tabelas",
        11: "Utilizar noções de proporcionalidade e semelhança",
        12: "Resolver problemas envolvendo equações e inequações",
        13: "Avaliar modelos matemáticos usados em contextos reais",
        14: "Analisar problemas envolvendo variação de grandezas",
        15: "Identificar regularidades e padrões matemáticos",
        16: "Utilizar conceitos de geometria analítica",
        17: "Compreender aplicações de razões trigonométricas",
        18: "Resolver problemas de contagem e probabilidade",
        19: "Avaliar propostas de tratamento de dados estatísticos",
        20: "Analisar problemas envolvendo funções matemáticas",
        21: "Utilizar conceitos de geometria espacial",
        22: "Resolver problemas envolvendo sequências numéricas",
        23: "Analisar situações envolvendo matemática financeira",
        24: "Compreender aplicações de matrizes e determinantes",
        25: "Resolver problemas usando sistemas de equações",
        26: "Analisar gráficos de funções",
        27: "Utilizar conceitos de geometria plana",
        28: "Resolver problemas de otimização",
        29: "Avaliar argumentos matemáticos e demonstrações",
        30: "Compreender aplicações de polinômios e suas propriedades",
    },
}


def get_skills_df():
    """Load skills data from CSV"""
    global _skills_df, _skills_year
    if _skills_df is None:
        data_dir = Path(__file__).resolve().parents[2] / "data"
        skills_path = find_latest_skills_file(data_dir)
        if skills_path and skills_path.exists():
            _skills_df = pd.read_csv(skills_path)
            _skills_year = get_file_year(skills_path)
    return _skills_df


def get_skills_year() -> Optional[int]:
    """Return the year represented by the cached national skills file."""
    if _skills_df is None:
        get_skills_df()
    return _skills_year


def fetch_school_skills_from_supabase(codigo_inep: str, ano: Optional[int] = None) -> List[Dict]:
    """
    Fetch skills data for a specific school from Supabase.

    Args:
        codigo_inep: School INEP code
        ano: Year of the data (defaults to latest available)

    Returns:
        List of skill performance records
    """
    supabase = get_supabase_store()

    try:
        query = supabase.table("school_skills").select("*").eq("codigo_inep", codigo_inep)

        if ano:
            query = query.eq("ano", ano)

        result = query.execute()

        if not result.data:
            return []

        records = []
        for row in result.data:
            records.append({
                "area": row["area"],
                "skill_num": row["skill_num"],
                "performance": float(row["performance"]),
                "descricao": row.get("descricao") or SKILL_DESCRIPTIONS.get(row["area"], {}).get(row["skill_num"], f"Habilidade {row['skill_num']}"),
                "ano": row.get("ano") or get_skills_year()
            })

        return records

    except Exception as e:
        print(f"Error fetching school skills from Supabase: {e}")
        return []


def get_available_years() -> List[int]:
    """Get list of years with school skills data."""
    supabase = get_supabase_store()

    try:
        result = supabase.table("school_skills").select("ano").limit(1000).execute()
        anos = sorted(set(r["ano"] for r in result.data), reverse=True)
        if anos:
            return anos
    except Exception:
        pass

    fallback_year = get_skills_year()
    return [fallback_year] if fallback_year is not None else []


class SchoolScore(BaseModel):
    ano: int
    nota_cn: Optional[float] = None
    nota_ch: Optional[float] = None
    nota_lc: Optional[float] = None
    nota_mt: Optional[float] = None
    nota_redacao: Optional[float] = None
    nota_media: Optional[float] = None
    ranking_brasil: Optional[int] = None
    desempenho_habilidades: Optional[float] = None
    competencia_redacao_media: Optional[float] = None


class SchoolSummary(BaseModel):
    codigo_inep: str
    nome_escola: str
    uf: Optional[str] = None
    tipo_escola: Optional[str] = None
    localizacao: Optional[str] = None
    porte: Optional[int] = None
    porte_label: Optional[str] = None
    qt_matriculas: Optional[int] = None
    ultimo_ranking: Optional[int] = None
    ultima_nota: Optional[float] = None
    anos_participacao: Optional[int] = None


class SchoolDetail(BaseModel):
    codigo_inep: str
    nome_escola: str
    uf: Optional[str] = None
    tipo_escola: Optional[str] = None
    historico: List[SchoolScore]
    tendencia: Optional[str] = None
    melhor_ano: Optional[int] = None
    melhor_ranking: Optional[int] = None


def get_supabase_store():
    """Get Supabase store client"""
    from data.supabase_store import get_client
    return get_client()


@router.get("/", response_model=List[SchoolSummary])
async def list_schools(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    localizacao: Optional[str] = None,
    porte: Optional[int] = None,
    ano: Optional[int] = None,
    order_by: str = Query("ranking", regex="^(ranking|nota|nome)$"),
    order: str = Query("asc", regex="^(asc|desc)$"),
    _: UserProfile = Depends(get_current_admin),
):
    """
    List schools with pagination and filtering (DuckDB optimized)

    Filters:
    - uf: State code (e.g., SP, RJ, CE)
    - tipo_escola: "Privada" or "Pública"
    - localizacao: "Urbana" or "Rural"
    - porte: 1-5 (1=Muito pequena, 2=Pequena, 3=Média, 4=Grande, 5=Muito grande)
    - search: Search by name or INEP code
    """
    # Use DuckDB for fast SQL queries
    records = duckdb_list_schools(
        page=page,
        limit=limit,
        search=search,
        uf=uf,
        tipo_escola=tipo_escola,
        localizacao=localizacao,
        porte=porte,
        ano=ano,
        order_by=order_by,
        order=order
    )

    return [
        SchoolSummary(
            codigo_inep=str(r["codigo_inep"]),
            nome_escola=str(r["nome_escola"]),
            uf=r.get("uf"),
            tipo_escola=r.get("tipo_escola"),
            localizacao=r.get("localizacao"),
            porte=r.get("porte"),
            porte_label=r.get("porte_label"),
            qt_matriculas=r.get("qt_matriculas"),
            ultimo_ranking=r.get("ultimo_ranking"),
            ultima_nota=r.get("ultima_nota"),
            anos_participacao=r.get("anos_participacao", 1)
        )
        for r in records
    ]


@router.get("/top")
async def get_top_schools(
    ano: Optional[int] = None,
    limit: int = Query(10, ge=1, le=100),
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    localizacao: Optional[str] = None,
    porte: Optional[int] = None,
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get top ranked schools (DuckDB optimized)

    Filters:
    - uf: State code (e.g., SP, RJ, CE)
    - tipo_escola: "Privada" or "Pública"
    - localizacao: "Urbana" or "Rural"
    - porte: 1-5 (1=Muito pequena, 2=Pequena, 3=Média, 4=Grande, 5=Muito grande)
    """
    # Use DuckDB for fast SQL queries
    return duckdb_get_top_schools(
        limit=limit,
        ano=ano,
        uf=uf,
        tipo_escola=tipo_escola,
        localizacao=localizacao,
        porte=porte
    )


@router.get("/search")
async def search_schools(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    _: UserProfile = Depends(get_current_admin),
):
    """
    Quick search for schools by name or INEP code (DuckDB optimized)
    """
    # Use DuckDB for fast SQL queries
    return duckdb_search_schools(q=q, limit=limit)


@router.get("/{codigo_inep}", response_model=SchoolDetail)
async def get_school(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get detailed information for a specific school (DuckDB optimized)
    """
    # Use DuckDB for fast SQL queries
    result = duckdb_get_school_detail(codigo_inep)

    if result is None:
        raise HTTPException(status_code=404, detail=f"School {codigo_inep} not found")

    # Convert history dicts to SchoolScore models
    historico = [
        SchoolScore(
            ano=h["ano"],
            nota_cn=h.get("nota_cn"),
            nota_ch=h.get("nota_ch"),
            nota_lc=h.get("nota_lc"),
            nota_mt=h.get("nota_mt"),
            nota_redacao=h.get("nota_redacao"),
            nota_media=h.get("nota_media"),
            ranking_brasil=h.get("ranking_brasil"),
            desempenho_habilidades=h.get("desempenho_habilidades"),
            competencia_redacao_media=h.get("competencia_redacao_media")
        )
        for h in result["historico"]
    ]

    return SchoolDetail(
        codigo_inep=result["codigo_inep"],
        nome_escola=result["nome_escola"],
        uf=result.get("uf"),
        tipo_escola=result.get("tipo_escola"),
        historico=historico,
        tendencia=result.get("tendencia"),
        melhor_ano=result.get("melhor_ano"),
        melhor_ranking=result.get("melhor_ranking")
    )


@router.get("/{codigo_inep}/history")
async def get_school_history(
    codigo_inep: str,
    _: UserProfile = Depends(get_authorized_school_user),
):
    """Get complete history for a school with year-over-year comparison"""
    client = get_supabase_store()
    result = client.table("enem_results").select(
        "ano, nome_escola, uf, dependencia, media_cn, media_ch, media_lc, "
        "media_mt, media_redacao, media_geral, ranking_nacional, ranking_uf"
    ).eq("codigo_inep", codigo_inep).order("ano").execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"School {codigo_inep} not found")

    latest = result.data[-1]
    history = []
    prev_ranking = None
    prev_nota = None

    for row in result.data:
        ranking = row.get("ranking_nacional")
        nota = float(row["media_geral"]) if row.get("media_geral") else None

        ranking_change = None
        nota_change = None
        if ranking is not None and prev_ranking is not None:
            ranking_change = prev_ranking - ranking
        if nota is not None and prev_nota is not None:
            nota_change = round(nota - prev_nota, 2)

        history.append({
            "ano": row["ano"],
            "ranking_brasil": ranking,
            "ranking_uf": row.get("ranking_uf"),
            "ranking_change": ranking_change,
            "nota_media": round(nota, 2) if nota else None,
            "nota_change": nota_change,
            "nota_cn": float(row["media_cn"]) if row.get("media_cn") else None,
            "nota_ch": float(row["media_ch"]) if row.get("media_ch") else None,
            "nota_lc": float(row["media_lc"]) if row.get("media_lc") else None,
            "nota_mt": float(row["media_mt"]) if row.get("media_mt") else None,
            "nota_redacao": float(row["media_redacao"]) if row.get("media_redacao") else None,
            "desempenho_habilidades": None,
            "competencia_redacao_media": None,
        })
        prev_ranking = ranking
        prev_nota = nota

    return {
        "codigo_inep": codigo_inep,
        "nome_escola": latest.get("nome_escola"),
        "uf": latest.get("uf"),
        "tipo_escola": latest.get("dependencia"),
        "anos_participacao": len(history),
        "history": history
    }


@router.get("/compare/{inep1}/{inep2}")
async def compare_schools(
    inep1: str,
    inep2: str,
    _: UserProfile = Depends(get_current_admin),
):
    """Compare two schools side by side"""
    client = get_supabase_store()

    r1 = client.table("enem_results").select(
        "ano, nome_escola, uf, media_geral, ranking_nacional"
    ).eq("codigo_inep", inep1).order("ano").execute()

    r2 = client.table("enem_results").select(
        "ano, nome_escola, uf, media_geral, ranking_nacional"
    ).eq("codigo_inep", inep2).order("ano").execute()

    if not r1.data:
        raise HTTPException(status_code=404, detail=f"School {inep1} not found")
    if not r2.data:
        raise HTTPException(status_code=404, detail=f"School {inep2} not found")

    years1 = {r["ano"]: r for r in r1.data}
    years2 = {r["ano"]: r for r in r2.data}
    common_years = sorted(set(years1.keys()) & set(years2.keys()))

    comparison = []
    for year in common_years:
        row1 = years1[year]
        row2 = years2[year]
        comparison.append({
            "ano": year,
            "escola1": {
                "nota_media": float(row1["media_geral"]) if row1.get("media_geral") else None,
                "ranking": row1.get("ranking_nacional"),
            },
            "escola2": {
                "nota_media": float(row2["media_geral"]) if row2.get("media_geral") else None,
                "ranking": row2.get("ranking_nacional"),
            }
        })

    return {
        "escola1": {
            "codigo_inep": inep1,
            "nome_escola": r1.data[-1].get("nome_escola"),
            "uf": r1.data[-1].get("uf"),
        },
        "escola2": {
            "codigo_inep": inep2,
            "nome_escola": r2.data[-1].get("nome_escola"),
            "uf": r2.data[-1].get("uf"),
        },
        "common_years": common_years,
        "comparison": comparison
    }


@router.get("/skills/worst")
async def get_worst_skills(
    area: Optional[str] = Query(None, regex="^(CN|CH|LC|MT)$"),
    limit: int = Query(10, ge=1, le=30),
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get the worst performing skills (most missed by students) per area.
    Returns the 10 most difficult skills for each area or a specific area.
    """
    df = get_skills_df()
    if df is None:
        raise HTTPException(status_code=500, detail="Skills data not available")

    result = {}

    areas = [area] if area else ["CN", "CH", "LC", "MT"]

    for a in areas:
        area_df = df[df["area"] == a].copy()
        # Sort by performance ascending (lowest = hardest)
        area_df = area_df.sort_values("performance", ascending=True).head(limit)

        result[a] = [
            {
                "skill_num": int(row["skill_num"]),
                "performance": round(float(row["performance"]) * 100, 1),
                "descricao": str(row["descricao"])
            }
            for _, row in area_df.iterrows()
        ]

    return {
        "ano": get_skills_year(),
        "skills_by_area": result
    }


@router.get("/skills/all")
async def get_all_skills(
    area: Optional[str] = Query(None, regex="^(CN|CH|LC|MT)$"),
    _: UserProfile = Depends(get_current_admin),
):
    """
    Get all skills performance data, optionally filtered by area.
    """
    df = get_skills_df()
    if df is None:
        raise HTTPException(status_code=500, detail="Skills data not available")

    if area:
        df = df[df["area"] == area]

    result = []
    for _, row in df.iterrows():
        result.append({
            "area": str(row["area"]),
            "skill_num": int(row["skill_num"]),
            "performance": round(float(row["performance"]) * 100, 1),
            "descricao": str(row["descricao"])
        })

    return {
        "ano": get_skills_year(),
        "total": len(result),
        "skills": result
    }


@router.get("/{codigo_inep}/skills")
async def get_school_skills(
    codigo_inep: str,
    limit: int = Query(10, ge=1, le=30),
    ano: Optional[int] = Query(None, description="Year of data (defaults to latest)"),
    _: UserProfile = Depends(get_authorized_school_user),
):
    """
    Get skill performance for a specific school.
    Returns the worst performing skills compared to national average.

    - **ano**: Year of data. If not specified, returns the latest available cycle.
    """
    # Fetch school-specific skills from Supabase (local database)
    school_skills = fetch_school_skills_from_supabase(codigo_inep, ano=ano)

    if not school_skills:
        raise HTTPException(status_code=404, detail=f"Skills data not available for school {codigo_inep}")

    # Get national average for comparison
    national_df = get_skills_df()

    # Build response with comparison to national average
    skills_by_area = {}

    for area in ["CN", "CH", "LC", "MT"]:
        area_skills = [s for s in school_skills if s["area"] == area]
        # Sort by performance (worst first)
        area_skills.sort(key=lambda x: x["performance"])

        # Get national averages for this area
        national_area = national_df[national_df["area"] == area] if national_df is not None else None

        enriched_skills = []
        for skill in area_skills[:limit]:
            national_perf = None
            diff = None

            if national_area is not None:
                nat_skill = national_area[national_area["skill_num"] == skill["skill_num"]]
                if not nat_skill.empty:
                    national_perf = round(float(nat_skill.iloc[0]["performance"]) * 100, 1)
                    diff = round(skill["performance"] - national_perf, 1)

            enriched_skills.append({
                "skill_num": skill["skill_num"],
                "performance": skill["performance"],
                "national_avg": national_perf,
                "diff": diff,
                "descricao": skill["descricao"],
                "status": "above" if diff and diff > 0 else "below" if diff and diff < 0 else "equal"
            })

        skills_by_area[area] = enriched_skills

    # Also get overall worst skills across all areas
    all_skills_sorted = sorted(school_skills, key=lambda x: x["performance"])[:limit]
    worst_overall = []

    for skill in all_skills_sorted:
        national_perf = None
        diff = None

        if national_df is not None:
            nat_skill = national_df[(national_df["area"] == skill["area"]) & (national_df["skill_num"] == skill["skill_num"])]
            if not nat_skill.empty:
                national_perf = round(float(nat_skill.iloc[0]["performance"]) * 100, 1)
                diff = round(skill["performance"] - national_perf, 1)

        worst_overall.append({
            "area": skill["area"],
            "skill_num": skill["skill_num"],
            "performance": skill["performance"],
            "national_avg": national_perf,
            "diff": diff,
            "descricao": skill["descricao"],
            "status": "above" if diff and diff > 0 else "below" if diff and diff < 0 else "equal"
        })

    # Get actual year from data (in case ano was not specified)
    available_years = get_available_years()
    actual_ano = (
        school_skills[0].get("ano")
        if school_skills and school_skills[0].get("ano") is not None
        else ano or (available_years[0] if available_years else get_skills_year())
    )

    return {
        "codigo_inep": codigo_inep,
        "ano": actual_ano,
        "available_years": available_years,
        "total_skills": len(school_skills),
        "worst_overall": worst_overall,
        "by_area": skills_by_area
    }
