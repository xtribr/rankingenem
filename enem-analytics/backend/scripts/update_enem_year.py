#!/usr/bin/env python3
"""Fluxo seguro para importar dados reais do ENEM por ano.

Este script foi desenhado para o ciclo ENEM 2025, mas aceita qualquer ano
permitido pelo schema. O comportamento padrao e dry-run: nada e gravado no
Supabase sem `--apply`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parents[1]
DATA_DIR = BACKEND_ROOT / "data"
DEFAULT_STAGING_DIR = PROJECT_ROOT / "microdados-2025"
DEFAULT_REPORT_DIR = DEFAULT_STAGING_DIR / "reports"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

SCORE_COLUMNS = ["media_cn", "media_ch", "media_lc", "media_mt", "media_redacao"]
OBJECTIVE_SCORE_COLUMNS = ["media_cn", "media_ch", "media_lc", "media_mt"]

DB_COLUMNS = [
    "codigo_inep",
    "ano",
    "nome_escola",
    "uf",
    "municipio",
    "dependencia",
    "media_cn",
    "media_ch",
    "media_lc",
    "media_mt",
    "media_redacao",
    "media_geral",
    "num_participantes",
    "taxa_participacao",
    "ranking_nacional",
    "ranking_uf",
    "ranking_municipio",
    "localizacao",
    "porte",
    "porte_label",
    "nota_tri_media",
    "desempenho_habilidades",
    "competencia_redacao_media",
    "inep_nome",
    "anos_participacao",
]

CONSOLIDATED_COLUMNS = [
    "ano",
    "codigo_inep",
    "nome_escola",
    "inep_nome",
    "nota_tri_media",
    "ranking_brasil",
    "nota_cn",
    "nota_ch",
    "nota_lc",
    "nota_mt",
    "nota_redacao",
    "nota_media",
    "tipo_escola",
    "desempenho_habilidades",
    "competencia_redacao_media",
    "localizacao",
    "qt_matriculas",
    "porte",
    "porte_label",
]

OFFICIAL_MAPPING = {
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

XTRI_MAPPING = {
    "codigo_inep": "codigo_inep",
    "nome_escola": "nome_escola",
    "uf": "uf",
    "municipio": "municipio",
    "tipo_escola": "dependencia",
    "dependencia": "dependencia",
    "nota_cn": "media_cn",
    "media_cn": "media_cn",
    "nota_ch": "media_ch",
    "media_ch": "media_ch",
    "nota_lc": "media_lc",
    "media_lc": "media_lc",
    "nota_mt": "media_mt",
    "media_mt": "media_mt",
    "nota_redacao": "media_redacao",
    "media_redacao": "media_redacao",
    "nota_media": "media_geral",
    "media_geral": "media_geral",
    "nota_tri_media": "nota_tri_media",
    "ranking_brasil": "ranking_nacional",
    "ranking_nacional": "ranking_nacional",
    "ranking_uf": "ranking_uf",
    "qt_matriculas": "num_participantes",
    "num_participantes": "num_participantes",
    "taxa_participacao": "taxa_participacao",
    "localizacao": "localizacao",
    "porte": "porte",
    "porte_label": "porte_label",
    "desempenho_habilidades": "desempenho_habilidades",
    "competencia_redacao_media": "competencia_redacao_media",
    "inep_nome": "inep_nome",
    "anos_participacao": "anos_participacao",
}


@dataclass(frozen=True)
class LoadedCSV:
    """Resultado da leitura flexivel do arquivo de entrada."""

    dataframe: pd.DataFrame
    encoding: str
    separator: str
    source_member: Optional[str]
    sha256: str
    byte_size: int


@dataclass(frozen=True)
class FormatDetection:
    """Formato detectado e mapa de colunas para o schema interno."""

    name: str
    mapping: dict[str, str]
    mapped_columns: int


def sha256_file(path: Path) -> str:
    """Calcula hash para rastreabilidade da fonte real."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_csv_bytes(data: bytes, encoding: str, separator: Optional[str]) -> pd.DataFrame:
    """Le um CSV a partir de bytes com separador explicito ou autodetectado."""
    if separator is None:
        return pd.read_csv(BytesIO(data), encoding=encoding, sep=None, engine="python")
    return pd.read_csv(BytesIO(data), encoding=encoding, sep=separator, low_memory=False)


def _extract_csv_bytes(path: Path, member: Optional[str] = None) -> tuple[bytes, Optional[str]]:
    """Carrega bytes de CSV direto ou de um ZIP com um CSV selecionado."""
    if path.suffix.lower() != ".zip":
        return path.read_bytes(), None

    with zipfile.ZipFile(path) as archive:
        csv_members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if member:
            if member not in csv_members:
                raise ValueError(f"CSV '{member}' nao encontrado no ZIP. Opcoes: {csv_members}")
            selected = member
        elif len(csv_members) == 1:
            selected = csv_members[0]
        else:
            raise ValueError(
                "ZIP contem multiplos CSVs. Informe --zip-member com um destes arquivos: "
                + ", ".join(csv_members)
            )
        return archive.read(selected), selected


def load_csv_flexible(path: Path, member: Optional[str] = None) -> LoadedCSV:
    """Le CSV real com encoding/separador robustos e sem modificar arquivos."""
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de entrada nao encontrado: {path}")

    raw_bytes, selected_member = _extract_csv_bytes(path, member=member)
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    separators: list[Optional[str]] = [None, ";", ","]
    failures: list[str] = []

    for encoding in encodings:
        for separator in separators:
            try:
                df = _read_csv_bytes(raw_bytes, encoding=encoding, separator=separator)
            except Exception as exc:  # noqa: BLE001 - reporta tentativas de parsing
                failures.append(f"{encoding}/{separator or 'auto'}: {exc}")
                continue

            # Um CSV real de ENEM precisa ter mais de uma coluna depois do parse.
            if len(df.columns) > 1:
                return LoadedCSV(
                    dataframe=df,
                    encoding=encoding,
                    separator=separator or "auto",
                    source_member=selected_member,
                    sha256=sha256_file(path),
                    byte_size=len(raw_bytes),
                )

    raise ValueError("Nao foi possivel ler CSV com schema tabular. Tentativas: " + " | ".join(failures[:5]))


def _case_insensitive_mapping(columns: Iterable[str], mapping: dict[str, str]) -> dict[str, str]:
    """Encontra colunas ignorando caixa, preservando o nome real de entrada."""
    lookup = {str(column).strip().lower(): str(column) for column in columns}
    resolved: dict[str, str] = {}
    for source, target in mapping.items():
        actual = lookup.get(source.lower())
        if actual:
            resolved[actual] = target
    return resolved


def detect_input_format(df: pd.DataFrame) -> FormatDetection:
    """Detecta se a fonte e oficial INEP ou consolidada XTRI."""
    official = _case_insensitive_mapping(df.columns, OFFICIAL_MAPPING)
    xtri = _case_insensitive_mapping(df.columns, XTRI_MAPPING)
    lower_columns = {str(column).strip().lower() for column in df.columns}

    has_official_identity = {"co_entidade", "no_entidade"}.issubset(lower_columns)
    has_xtri_identity = "codigo_inep" in lower_columns

    if has_xtri_identity and len(xtri) >= 6:
        return FormatDetection("xtri_consolidado", xtri, len(xtri))
    if has_official_identity and len(official) >= 6:
        return FormatDetection("inep_oficial", official, len(official))

    raise ValueError(
        "Formato nao reconhecido. Esperado CSV oficial INEP ou consolidado XTRI. "
        f"Colunas encontradas: {list(df.columns)[:20]}"
    )


def parse_numeric(series: pd.Series) -> pd.Series:
    """Converte numeros com decimal brasileiro ou internacional."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")

    text = series.astype(str).str.strip()
    has_comma = text.str.contains(",", regex=False, na=False)
    has_dot = text.str.contains(".", regex=False, na=False)
    normalized = text.copy()
    both = has_comma & has_dot
    normalized.loc[both] = normalized.loc[both].str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    comma_only = has_comma & ~has_dot
    normalized.loc[comma_only] = normalized.loc[comma_only].str.replace(",", ".", regex=False)
    normalized = normalized.replace({"": None, "nan": None, "None": None})
    return pd.to_numeric(normalized, errors="coerce")


def normalize_codigo_inep(series: pd.Series) -> pd.Series:
    """Normaliza INEP como texto com zero a esquerda quando necessario."""
    text = series.astype(str).str.strip()
    text = text.str.replace(r"\.0$", "", regex=True)
    text = text.str.replace(r"\D", "", regex=True)
    text = text.where(text.str.len() > 0)
    return text.str.zfill(8)


def normalize_dependencia(series: pd.Series) -> pd.Series:
    """Padroniza dependencia para a taxonomia atual do app: Publica/Privada."""
    numeric = pd.to_numeric(series, errors="coerce")
    result = pd.Series(index=series.index, dtype="object")
    result.loc[numeric.isin([1, 2, 3])] = "Pública"
    result.loc[numeric == 4] = "Privada"

    text = series.astype(str).str.strip().str.lower()
    public_mask = text.isin(["publica", "pública", "federal", "estadual", "municipal", "1", "2", "3"])
    private_mask = text.isin(["privada", "particular", "4"])
    result.loc[result.isna() & public_mask] = "Pública"
    result.loc[result.isna() & private_mask] = "Privada"
    result.loc[result.isna() & text.ne("") & text.ne("nan")] = series.astype(str).str.strip()
    return result


def transform_to_enem_results(df: pd.DataFrame, year: int) -> tuple[pd.DataFrame, FormatDetection]:
    """Transforma a fonte detectada para o schema de `enem_results`."""
    detection = detect_input_format(df)
    result = df.rename(columns=detection.mapping)
    result = result[[column for column in DB_COLUMNS if column in result.columns]].copy()
    result["ano"] = int(year)

    if "codigo_inep" not in result.columns:
        raise ValueError("Coluna codigo_inep ausente apos transformacao.")
    result["codigo_inep"] = normalize_codigo_inep(result["codigo_inep"])

    if "dependencia" in result.columns:
        result["dependencia"] = normalize_dependencia(result["dependencia"])

    for column in SCORE_COLUMNS + [
        "media_geral",
        "nota_tri_media",
        "num_participantes",
        "taxa_participacao",
        "ranking_nacional",
        "ranking_uf",
        "ranking_municipio",
        "porte",
        "desempenho_habilidades",
        "competencia_redacao_media",
        "anos_participacao",
    ]:
        if column in result.columns:
            result[column] = parse_numeric(result[column])

    complete_score_mask = result[SCORE_COLUMNS].notna().all(axis=1) if set(SCORE_COLUMNS).issubset(result.columns) else False
    if "media_geral" not in result.columns:
        result["media_geral"] = pd.NA
    if isinstance(complete_score_mask, pd.Series):
        computed = result.loc[complete_score_mask, SCORE_COLUMNS].mean(axis=1).round(2)
        result.loc[result["media_geral"].isna() & complete_score_mask, "media_geral"] = computed
    result["media_geral"] = parse_numeric(result["media_geral"])

    # nota_tri_media e nota_media sao equivalentes na base consolidada atual.
    if "nota_tri_media" not in result.columns:
        result["nota_tri_media"] = result["media_geral"]
    else:
        result["nota_tri_media"] = result["nota_tri_media"].fillna(result["media_geral"])

    result["inep_nome"] = result.get("inep_nome")
    if "nome_escola" in result.columns:
        result["inep_nome"] = result["inep_nome"].fillna(result["codigo_inep"] + "-" + result["nome_escola"].astype(str))

    result = result.dropna(subset=["codigo_inep"]).copy()
    result = recalculate_rankings(result)
    for column in DB_COLUMNS:
        if column not in result.columns:
            result[column] = pd.NA
    return result[DB_COLUMNS].copy(), detection


def enrich_with_censo(df: pd.DataFrame, censo_file: Path) -> pd.DataFrame:
    """Completa metadados escolares usando arquivo real do Censo informado."""
    if not censo_file.exists():
        raise FileNotFoundError(f"Arquivo de Censo nao encontrado: {censo_file}")

    censo = pd.read_csv(censo_file, dtype={"codigo_inep": str})
    censo["codigo_inep"] = normalize_codigo_inep(censo["codigo_inep"])
    censo = censo.drop_duplicates("codigo_inep").set_index("codigo_inep")
    result = df.copy()

    fill_map = {
        "uf": "uf",
        "localizacao": "localizacao",
        "porte": "porte",
        "porte_label": "porte_label",
        "num_participantes": "qt_matriculas",
        "dependencia": "dependencia",
    }
    for target, source in fill_map.items():
        if source not in censo.columns:
            continue
        mapped = result["codigo_inep"].map(censo[source])
        if target == "dependencia":
            mapped = normalize_dependencia(mapped)
        if target not in result.columns:
            result[target] = mapped
        else:
            result[target] = result[target].fillna(mapped)

    if "nome_escola" in result.columns and "nome_escola_censo" in censo.columns:
        mapped_name = result["codigo_inep"].map(censo["nome_escola_censo"])
        result["nome_escola"] = result["nome_escola"].fillna(mapped_name)

    return result


def recalculate_rankings(df: pd.DataFrame) -> pd.DataFrame:
    """Recalcula rankings sem ranquear escolas sem media_geral real."""
    df = df.copy()
    valid = df["media_geral"].notna()
    df["ranking_nacional"] = pd.NA
    df.loc[valid, "ranking_nacional"] = (
        df.loc[valid, "media_geral"].rank(method="min", ascending=False).astype("Int64")
    )

    df["ranking_uf"] = pd.NA
    if "uf" in df.columns:
        df.loc[valid, "ranking_uf"] = (
            df.loc[valid].groupby("uf")["media_geral"].rank(method="min", ascending=False).astype("Int64")
        )
    return df.sort_values(["ranking_nacional", "codigo_inep"], na_position="last").reset_index(drop=True)


def build_validation_report(
    *,
    input_path: Path,
    loaded: LoadedCSV,
    detection: FormatDetection,
    raw_df: pd.DataFrame,
    transformed: pd.DataFrame,
    year: int,
) -> dict[str, Any]:
    """Monta relatorio objetivo com N, fonte e bloqueios."""
    errors: list[str] = []
    warnings: list[str] = []

    required = ["codigo_inep", "ano", "nome_escola", "uf"]
    for column in required:
        if column not in transformed.columns:
            errors.append(f"Coluna obrigatoria ausente: {column}")
        elif transformed[column].isna().all():
            errors.append(f"Coluna obrigatoria sem valores: {column}")

    duplicate_count = int(transformed.duplicated(subset=["codigo_inep", "ano"]).sum())
    if duplicate_count:
        errors.append(f"Duplicidades em codigo_inep+ano: {duplicate_count}")

    mapped_ratio = len(transformed) / max(len(raw_df), 1)
    if mapped_ratio < 0.95:
        errors.append(f"Apenas {mapped_ratio:.1%} das linhas brutas sobreviveram a transformacao.")

    for column in SCORE_COLUMNS + ["media_geral"]:
        if column in transformed.columns:
            invalid = transformed[column].notna() & ~transformed[column].between(0, 1000)
            if invalid.any():
                errors.append(f"{column} fora de [0,1000]: {int(invalid.sum())} linhas")

    if set(SCORE_COLUMNS).issubset(transformed.columns):
        complete = transformed[SCORE_COLUMNS].notna().all(axis=1)
        if complete.any():
            computed = transformed.loc[complete, SCORE_COLUMNS].mean(axis=1)
            diff = (transformed.loc[complete, "media_geral"] - computed).abs()
            if diff.max() > 1:
                errors.append(
                    "media_geral diverge da media das 5 notas em mais de 1 ponto "
                    f"(max_diff={diff.max():.2f})"
                )

    null_counts = {
        column: int(transformed[column].isna().sum())
        for column in [
            "media_cn",
            "media_ch",
            "media_lc",
            "media_mt",
            "media_redacao",
            "media_geral",
            "desempenho_habilidades",
            "competencia_redacao_media",
            "localizacao",
            "porte",
        ]
        if column in transformed.columns
    }

    if null_counts.get("desempenho_habilidades", 0):
        warnings.append("desempenho_habilidades ausente em parte da base; nao sera imputado.")
    if null_counts.get("competencia_redacao_media", 0):
        warnings.append("competencia_redacao_media ausente em parte da base; nao sera imputado.")

    score_ranges = {
        column: {
            "min": float(transformed[column].min()) if transformed[column].notna().any() else None,
            "max": float(transformed[column].max()) if transformed[column].notna().any() else None,
        }
        for column in SCORE_COLUMNS + ["media_geral"]
        if column in transformed.columns
    }

    return {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": {
            "path": str(input_path),
            "zip_member": loaded.source_member,
            "sha256": loaded.sha256,
            "byte_size": loaded.byte_size,
            "encoding": loaded.encoding,
            "separator": loaded.separator,
        },
        "year": int(year),
        "detected_format": detection.name,
        "mapped_columns": detection.mapped_columns,
        "counts": {
            "raw_rows": int(len(raw_df)),
            "transformed_rows": int(len(transformed)),
            "unique_schools": int(transformed["codigo_inep"].nunique()),
            "ranked_rows": int(transformed["ranking_nacional"].notna().sum()),
        },
        "null_counts": null_counts,
        "score_ranges": score_ranges,
        "top_10": transformed[
            ["ranking_nacional", "codigo_inep", "nome_escola", "uf", "media_geral"]
        ].head(10).to_dict("records"),
        "errors": errors,
        "warnings": warnings,
        "status": "blocked" if errors else "ok",
    }


def write_report(report: dict[str, Any], report_dir: Path, year: int, dry_run: bool) -> Path:
    """Persiste relatorio auditavel fora dos dados versionados."""
    report_dir.mkdir(parents=True, exist_ok=True)
    suffix = "dry_run" if dry_run else "apply"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = report_dir / f"enem_{year}_{suffix}_{stamp}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_environment(target_env: str, confirm_production: Optional[str]) -> None:
    """Carrega .env local e aplica travas para producao."""
    load_dotenv(BACKEND_ROOT / ".env", override=False)
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios.")

    is_local_url = "127.0.0.1" in supabase_url or "localhost" in supabase_url
    if target_env == "local" and not is_local_url:
        raise RuntimeError(f"--env local exige Supabase local, recebido: {supabase_url}")
    if target_env == "production":
        if is_local_url:
            raise RuntimeError("--env production nao pode apontar para Supabase local.")
        if confirm_production != "IMPORTAR-ENEM-PRODUCAO":
            raise RuntimeError("Producao exige --confirm-production IMPORTAR-ENEM-PRODUCAO")


def get_supabase_client():
    """Cria cliente Supabase apenas apos as travas de ambiente."""
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def existing_year_count(year: int) -> int:
    """Conta registros ja existentes para impedir sobrescrita acidental."""
    client = get_supabase_client()
    result = (
        client.table("enem_results")
        .select("codigo_inep", count="exact")
        .eq("ano", int(year))
        .limit(1)
        .execute()
    )
    return int(result.count or 0)


def dataframe_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Converte DataFrame para JSON serializavel aceito pelo PostgREST."""
    cleaned = df.where(pd.notna(df), None)
    return json.loads(cleaned.to_json(orient="records", force_ascii=False))


def apply_to_supabase(df: pd.DataFrame, year: int, allow_existing_year: bool, batch_size: int) -> dict[str, Any]:
    """Executa upsert em lotes com verificacao final de contagem."""
    current_count = existing_year_count(year)
    if current_count and not allow_existing_year:
        raise RuntimeError(
            f"Ja existem {current_count} registros para {year}. "
            "Use --allow-existing-year somente se quiser atualizar por upsert."
        )

    client = get_supabase_client()
    records = dataframe_to_records(df)
    uploaded = 0
    failed_batches: list[dict[str, Any]] = []

    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]
        try:
            client.table("enem_results").upsert(batch, on_conflict="codigo_inep,ano").execute()
            uploaded += len(batch)
        except Exception as exc:  # noqa: BLE001 - erro vai para relatorio
            failed_batches.append({"start": start, "size": len(batch), "error": str(exc)})

    final_count = existing_year_count(year)
    return {
        "uploaded": uploaded,
        "failed_batches": failed_batches,
        "final_year_count": final_count,
        "expected_year_count": len(records),
        "status": "ok" if not failed_batches and final_count == len(records) else "blocked",
    }


def to_consolidated_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Converte `enem_results` para o schema CSV consumido pelos modelos atuais."""
    output = pd.DataFrame(index=df.index)
    output["ano"] = df["ano"]
    output["codigo_inep"] = df["codigo_inep"]
    output["nome_escola"] = df["nome_escola"]
    output["inep_nome"] = df["inep_nome"].fillna(df["codigo_inep"] + "-" + df["nome_escola"].astype(str))
    output["nota_tri_media"] = df["nota_tri_media"].fillna(df["media_geral"])
    output["ranking_brasil"] = df["ranking_nacional"]
    output["nota_cn"] = df["media_cn"]
    output["nota_ch"] = df["media_ch"]
    output["nota_lc"] = df["media_lc"]
    output["nota_mt"] = df["media_mt"]
    output["nota_redacao"] = df["media_redacao"]
    output["nota_media"] = df["media_geral"]
    output["tipo_escola"] = df["dependencia"]
    output["desempenho_habilidades"] = df["desempenho_habilidades"]
    output["competencia_redacao_media"] = df["competencia_redacao_media"]
    output["localizacao"] = df["localizacao"]
    output["qt_matriculas"] = df["num_participantes"]
    output["porte"] = df["porte"]
    output["porte_label"] = df["porte_label"]
    return output[CONSOLIDATED_COLUMNS].copy()


def write_consolidated_file(transformed: pd.DataFrame, year: int, output_path: Optional[Path]) -> Path:
    """Gera CSV consolidado 2018-ano para o preprocessor atual."""
    from data.year_resolver import find_latest_enem_results_file

    latest = find_latest_enem_results_file(DATA_DIR)
    if latest is None:
        raise FileNotFoundError("Nenhum CSV consolidado historico encontrado em backend/data.")

    historical = pd.read_csv(latest, dtype={"codigo_inep": str})
    historical = historical[historical["ano"].astype(int) < int(year)]
    current = to_consolidated_schema(transformed)
    combined = pd.concat([historical[CONSOLIDATED_COLUMNS], current], ignore_index=True)
    destination = output_path or DATA_DIR / f"enem_2018_{year}_completo.csv"
    destination.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(destination, index=False)
    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Atualizacao segura de dados ENEM por ano.")
    parser.add_argument("--year", type=int, required=True, help="Ano dos dados, ex.: 2025")
    parser.add_argument("--input", type=Path, required=True, help="CSV/ZIP real de entrada")
    parser.add_argument("--zip-member", help="Nome do CSV dentro do ZIP quando houver multiplos")
    parser.add_argument("--env", choices=["local", "production"], default="local")
    parser.add_argument("--dry-run", action="store_true", help="Valida sem gravar. E o padrao.")
    parser.add_argument("--apply", action="store_true", help="Grava no Supabase apos validacao")
    parser.add_argument("--allow-existing-year", action="store_true", help="Permite upsert se o ano ja tiver linhas")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORT_DIR)
    parser.add_argument("--censo-file", type=Path, help="CSV real do Censo para enriquecer UF/porte/localizacao")
    parser.add_argument("--write-consolidated", action="store_true", help="Gera enem_2018_<ano>_completo.csv")
    parser.add_argument("--consolidated-output", type=Path)
    parser.add_argument("--confirm-production")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dry_run = not args.apply
    load_environment(args.env, args.confirm_production)

    loaded = load_csv_flexible(args.input, member=args.zip_member)
    transformed, detection = transform_to_enem_results(loaded.dataframe, args.year)
    if args.censo_file:
        transformed = enrich_with_censo(transformed, args.censo_file)
    report = build_validation_report(
        input_path=args.input,
        loaded=loaded,
        detection=detection,
        raw_df=loaded.dataframe,
        transformed=transformed,
        year=args.year,
    )
    if args.censo_file:
        report["censo_source"] = {
            "path": str(args.censo_file),
            "sha256": sha256_file(args.censo_file),
        }

    if report["errors"]:
        report_path = write_report(report, args.report_dir, args.year, dry_run=True)
        print(f"Relatorio: {report_path}")
        print(json.dumps({"status": "blocked", "errors": report["errors"]}, ensure_ascii=False, indent=2))
        return 2

    if args.apply:
        apply_result = apply_to_supabase(
            transformed,
            year=args.year,
            allow_existing_year=args.allow_existing_year,
            batch_size=args.batch_size,
        )
        report["apply_result"] = apply_result
        if apply_result["status"] != "ok":
            report["status"] = "blocked"
            report["errors"].append("Falha no apply Supabase; veja apply_result.")

    if args.write_consolidated:
        consolidated_path = write_consolidated_file(transformed, args.year, args.consolidated_output)
        report["consolidated_output"] = str(consolidated_path)

    report_path = write_report(report, args.report_dir, args.year, dry_run=dry_run)
    print(f"Relatorio: {report_path}")
    print(json.dumps({
        "status": report["status"],
        "detected_format": report["detected_format"],
        "counts": report["counts"],
        "warnings": report["warnings"],
    }, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
