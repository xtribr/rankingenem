"""
DuckDB-based data store for fast analytical queries.
Replaces Pandas for school data queries - 10-100x faster.
"""

import duckdb
from pathlib import Path
from typing import Optional, List, Dict, Any

# Global connection (in-memory database)
_conn: Optional[duckdb.DuckDBPyConnection] = None
_initialized = False


def get_connection() -> duckdb.DuckDBPyConnection:
    """Get or create DuckDB connection"""
    global _conn, _initialized
    if _conn is None:
        _conn = duckdb.connect(":memory:")
        _initialized = False
    return _conn


def init_database():
    """Load CSV data into DuckDB on startup"""
    global _initialized
    if _initialized:
        return

    conn = get_connection()
    data_path = Path(__file__).parent / "enem_2018_2024_completo.csv"

    print("Loading data into DuckDB...")

    # Load CSV directly into DuckDB (very fast)
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS schools AS
        SELECT
            CAST(codigo_inep AS VARCHAR) as codigo_inep,
            CAST(ano AS INTEGER) as ano,
            nome_escola,
            tipo_escola,
            localizacao,
            CAST(porte AS INTEGER) as porte,
            porte_label,
            CAST(qt_matriculas AS INTEGER) as qt_matriculas,
            CAST(nota_cn AS DOUBLE) as nota_cn,
            CAST(nota_ch AS DOUBLE) as nota_ch,
            CAST(nota_lc AS DOUBLE) as nota_lc,
            CAST(nota_mt AS DOUBLE) as nota_mt,
            CAST(nota_redacao AS DOUBLE) as nota_redacao,
            CAST(nota_media AS DOUBLE) as nota_media,
            CAST(ranking_brasil AS INTEGER) as ranking_brasil,
            CAST(desempenho_habilidades AS DOUBLE) as desempenho_habilidades,
            CAST(competencia_redacao_media AS DOUBLE) as competencia_redacao_media,
            SUBSTRING(CAST(codigo_inep AS VARCHAR), 1, 2) as uf_code
        FROM read_csv_auto('{data_path}')
    """)

    # Add UF mapping
    conn.execute("""
        ALTER TABLE schools ADD COLUMN IF NOT EXISTS uf VARCHAR;
        UPDATE schools SET uf = CASE uf_code
            WHEN '11' THEN 'RO' WHEN '12' THEN 'AC' WHEN '13' THEN 'AM'
            WHEN '14' THEN 'RR' WHEN '15' THEN 'PA' WHEN '16' THEN 'AP'
            WHEN '17' THEN 'TO' WHEN '21' THEN 'MA' WHEN '22' THEN 'PI'
            WHEN '23' THEN 'CE' WHEN '24' THEN 'RN' WHEN '25' THEN 'PB'
            WHEN '26' THEN 'PE' WHEN '27' THEN 'AL' WHEN '28' THEN 'SE'
            WHEN '29' THEN 'BA' WHEN '31' THEN 'MG' WHEN '32' THEN 'ES'
            WHEN '33' THEN 'RJ' WHEN '35' THEN 'SP' WHEN '41' THEN 'PR'
            WHEN '42' THEN 'SC' WHEN '43' THEN 'RS' WHEN '50' THEN 'MS'
            WHEN '51' THEN 'MT' WHEN '52' THEN 'GO' WHEN '53' THEN 'DF'
            ELSE NULL
        END;
    """)

    # Pre-compute anos_participacao
    conn.execute("""
        CREATE TABLE IF NOT EXISTS school_years AS
        SELECT codigo_inep, COUNT(DISTINCT ano) as anos_participacao
        FROM schools
        GROUP BY codigo_inep
    """)

    # Create indexes for fast lookups
    conn.execute("CREATE INDEX IF NOT EXISTS idx_schools_ano ON schools(ano)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_schools_inep ON schools(codigo_inep)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_schools_ranking ON schools(ranking_brasil)")

    # Get stats
    result = conn.execute("SELECT COUNT(*) as total, MAX(ano) as latest_year FROM schools").fetchone()
    print(f"DuckDB loaded: {result[0]:,} records, latest year: {result[1]}")

    _initialized = True


def get_latest_year() -> int:
    """Get the most recent year in the data"""
    conn = get_connection()
    result = conn.execute("SELECT MAX(ano) FROM schools").fetchone()
    if result and result[0] is not None:
        return int(result[0])

    # Fallback: resolve from the newest CSV file in the backend data directory
    from pathlib import Path

    from data.year_resolver import find_latest_enem_results_file, get_file_year

    data_dir = Path(__file__).resolve().parent
    latest_file = find_latest_enem_results_file(data_dir)
    file_year = get_file_year(latest_file) if latest_file else None
    if file_year is not None:
        return file_year

    raise RuntimeError("DuckDB schools table is empty and no yearly CSV found")


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
    """List schools with filtering and pagination - SQL optimized"""
    conn = get_connection()
    target_ano = ano or get_latest_year()

    # Build WHERE clause
    conditions = [f"s.ano = {target_ano}"]
    if search:
        search_escaped = search.replace("'", "''")
        conditions.append(f"(LOWER(s.nome_escola) LIKE '%{search_escaped.lower()}%' OR s.codigo_inep LIKE '%{search_escaped}%')")
    if uf:
        conditions.append(f"s.uf = '{uf.upper()}'")
    if tipo_escola:
        conditions.append(f"s.tipo_escola = '{tipo_escola}'")
    if localizacao:
        conditions.append(f"s.localizacao = '{localizacao}'")
    if porte:
        conditions.append(f"s.porte = {porte}")

    where_clause = " AND ".join(conditions)

    # Build ORDER BY
    if order_by == "ranking":
        order_clause = f"s.ranking_brasil {'ASC' if order == 'asc' else 'DESC'} NULLS LAST"
        conditions.append("s.ranking_brasil IS NOT NULL")
        where_clause = " AND ".join(conditions)
    elif order_by == "nota":
        order_clause = f"s.nota_media {'ASC' if order == 'asc' else 'DESC'}"
    else:
        order_clause = f"s.nome_escola {'ASC' if order == 'asc' else 'DESC'}"

    offset = (page - 1) * limit

    query = f"""
        SELECT
            s.codigo_inep,
            s.nome_escola,
            s.uf,
            s.tipo_escola,
            s.localizacao,
            s.porte,
            s.porte_label,
            s.qt_matriculas,
            s.ranking_brasil as ultimo_ranking,
            ROUND(s.nota_media, 2) as ultima_nota,
            COALESCE(sy.anos_participacao, 1) as anos_participacao
        FROM schools s
        LEFT JOIN school_years sy ON s.codigo_inep = sy.codigo_inep
        WHERE {where_clause}
        ORDER BY {order_clause}
        LIMIT {limit} OFFSET {offset}
    """

    result = conn.execute(query).fetchall()
    columns = ['codigo_inep', 'nome_escola', 'uf', 'tipo_escola', 'localizacao',
               'porte', 'porte_label', 'qt_matriculas', 'ultimo_ranking', 'ultima_nota', 'anos_participacao']

    return [dict(zip(columns, row)) for row in result]


def get_top_schools(
    limit: int = 10,
    ano: Optional[int] = None,
    uf: Optional[str] = None,
    tipo_escola: Optional[str] = None,
    localizacao: Optional[str] = None,
    porte: Optional[int] = None
) -> Dict[str, Any]:
    """Get top ranked schools - SQL optimized"""
    conn = get_connection()
    target_ano = ano or get_latest_year()

    conditions = [f"ano = {target_ano}", "ranking_brasil IS NOT NULL"]
    if uf:
        conditions.append(f"uf = '{uf.upper()}'")
    if tipo_escola:
        conditions.append(f"tipo_escola = '{tipo_escola}'")
    if localizacao:
        conditions.append(f"localizacao = '{localizacao}'")
    if porte:
        conditions.append(f"porte = {porte}")

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            ranking_brasil as ranking,
            codigo_inep,
            nome_escola,
            uf,
            tipo_escola,
            localizacao,
            porte,
            porte_label,
            qt_matriculas,
            ROUND(nota_media, 2) as nota_media,
            ROUND(nota_cn, 2) as nota_cn,
            ROUND(nota_ch, 2) as nota_ch,
            ROUND(nota_lc, 2) as nota_lc,
            ROUND(nota_mt, 2) as nota_mt,
            ROUND(nota_redacao, 2) as nota_redacao,
            ROUND(desempenho_habilidades, 4) as desempenho_habilidades,
            ROUND(competencia_redacao_media, 2) as competencia_redacao_media
        FROM schools
        WHERE {where_clause}
        ORDER BY ranking_brasil ASC
        LIMIT {limit}
    """

    result = conn.execute(query).fetchall()
    columns = ['ranking', 'codigo_inep', 'nome_escola', 'uf', 'tipo_escola', 'localizacao',
               'porte', 'porte_label', 'qt_matriculas', 'nota_media', 'nota_cn', 'nota_ch',
               'nota_lc', 'nota_mt', 'nota_redacao', 'desempenho_habilidades', 'competencia_redacao_media']

    schools = [dict(zip(columns, row)) for row in result]

    return {
        "ano": target_ano,
        "total": len(schools),
        "schools": schools
    }


def search_schools(q: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Quick search for schools - SQL optimized"""
    conn = get_connection()
    q_escaped = q.replace("'", "''").lower()

    query = f"""
        WITH latest AS (
            SELECT codigo_inep, MAX(ano) as max_ano
            FROM schools
            GROUP BY codigo_inep
        )
        SELECT
            s.codigo_inep,
            s.nome_escola,
            s.uf,
            s.ano as ultimo_ano
        FROM schools s
        JOIN latest l ON s.codigo_inep = l.codigo_inep AND s.ano = l.max_ano
        WHERE LOWER(s.nome_escola) LIKE '%{q_escaped}%'
           OR s.codigo_inep LIKE '%{q}%'
        LIMIT {limit}
    """

    result = conn.execute(query).fetchall()
    columns = ['codigo_inep', 'nome_escola', 'uf', 'ultimo_ano']

    return [dict(zip(columns, row)) for row in result]


def get_school_detail(codigo_inep: str) -> Optional[Dict[str, Any]]:
    """Get detailed school info with history - SQL optimized"""
    conn = get_connection()

    # Get history
    history_query = f"""
        SELECT
            ano,
            ROUND(nota_cn, 2) as nota_cn,
            ROUND(nota_ch, 2) as nota_ch,
            ROUND(nota_lc, 2) as nota_lc,
            ROUND(nota_mt, 2) as nota_mt,
            ROUND(nota_redacao, 2) as nota_redacao,
            ROUND(nota_media, 2) as nota_media,
            ranking_brasil,
            ROUND(desempenho_habilidades, 4) as desempenho_habilidades,
            ROUND(competencia_redacao_media, 2) as competencia_redacao_media
        FROM schools
        WHERE codigo_inep = '{codigo_inep}'
        ORDER BY ano
    """

    history_result = conn.execute(history_query).fetchall()
    if not history_result:
        return None

    history_columns = ['ano', 'nota_cn', 'nota_ch', 'nota_lc', 'nota_mt',
                       'nota_redacao', 'nota_media', 'ranking_brasil',
                       'desempenho_habilidades', 'competencia_redacao_media']
    historico = [dict(zip(history_columns, row)) for row in history_result]

    # Get latest info
    latest = historico[-1]

    # Get school metadata from latest record
    meta_query = f"""
        SELECT nome_escola, uf, tipo_escola
        FROM schools
        WHERE codigo_inep = '{codigo_inep}'
        ORDER BY ano DESC
        LIMIT 1
    """
    meta = conn.execute(meta_query).fetchone()

    # Calculate trend
    tendencia = None
    if len(historico) >= 2:
        recent = historico[-3:] if len(historico) >= 3 else historico
        if recent[0].get('nota_media') and recent[-1].get('nota_media'):
            diff = recent[-1]['nota_media'] - recent[0]['nota_media']
            if diff > 10:
                tendencia = "subindo"
            elif diff < -10:
                tendencia = "descendo"
            else:
                tendencia = "estável"

    # Get best year
    best_query = f"""
        SELECT ano, ranking_brasil
        FROM schools
        WHERE codigo_inep = '{codigo_inep}' AND ranking_brasil IS NOT NULL
        ORDER BY ranking_brasil ASC
        LIMIT 1
    """
    best = conn.execute(best_query).fetchone()

    return {
        "codigo_inep": codigo_inep,
        "nome_escola": meta[0] if meta else None,
        "uf": meta[1] if meta else None,
        "tipo_escola": meta[2] if meta else None,
        "historico": historico,
        "tendencia": tendencia,
        "melhor_ano": best[0] if best else None,
        "melhor_ranking": best[1] if best else None
    }


def get_stats() -> Dict[str, Any]:
    """Get general statistics - SQL optimized"""
    conn = get_connection()

    stats_query = """
        SELECT
            COUNT(*) as total_records,
            COUNT(DISTINCT codigo_inep) as total_schools,
            ROUND(AVG(nota_cn), 2) as avg_cn,
            ROUND(AVG(nota_ch), 2) as avg_ch,
            ROUND(AVG(nota_lc), 2) as avg_lc,
            ROUND(AVG(nota_mt), 2) as avg_mt,
            ROUND(AVG(nota_redacao), 2) as avg_redacao
        FROM schools
    """
    result = conn.execute(stats_query).fetchone()

    years = conn.execute("SELECT DISTINCT ano FROM schools ORDER BY ano").fetchall()
    states = conn.execute("SELECT DISTINCT uf FROM schools WHERE uf IS NOT NULL ORDER BY uf").fetchall()

    return {
        "total_records": result[0],
        "total_schools": result[1],
        "years": [y[0] for y in years],
        "states": [s[0] for s in states],
        "avg_scores": {
            "nota_cn": result[2],
            "nota_ch": result[3],
            "nota_lc": result[4],
            "nota_mt": result[5],
            "nota_redacao": result[6],
        }
    }
