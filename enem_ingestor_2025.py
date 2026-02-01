"""
Ingestor de Dados ENEM 2025
===========================

Script para ingestão de dados do ENEM 2025 com:
- Validação de schema
- Normalização de nomes de colunas
- Detecção de duplicatas
- Relatório de qualidade de dados
"""

import sqlite3
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import argparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ENEMDataValidator:
    """Validador de dados ENEM."""
    
    # Mapeamento de nomes de colunas (variantes → padrão)
    COLUMN_MAPPING = {
        # Notas por área
        'nota_cn': ['nota_cn', 'ciencias_natureza', 'nota_ciencias_natureza', 'cn'],
        'nota_ch': ['nota_ch', 'ciencias_humanas', 'nota_ciencias_humanas', 'ch'],
        'nota_lc': ['nota_lc', 'linguagens', 'nota_linguagens', 'lc', 'linguagem'],
        'nota_mt': ['nota_mt', 'matematica', 'nota_matematica', 'mt'],
        'nota_redacao': ['nota_redacao', 'redacao', 'redação', 'nota_redação', 'Redação'],
        
        # Competências
        'competencia_1': ['competencia_1', 'comp1', 'c1', 'Competência 1', 'Competência 1'],
        'competencia_2': ['competencia_2', 'comp2', 'c2', 'Competência 2'],
        'competencia_3': ['competencia_3', 'comp3', 'c3', 'Competência 3'],
        'competencia_4': ['competencia_4', 'comp4', 'c4', 'Competência 4'],
        'competencia_5': ['competencia_5', 'comp5', 'c5', 'Competência 5'],
        
        # Identificação
        'codigo_inep': ['codigo_inep', 'inep', 'cod_inep', 'CO_ENTIDADE', 'id_inep'],
        'nome_escola': ['nome_escola', 'escola', 'NO_ENTIDADE', 'nome'],
        'inep_nome': ['inep_nome', 'inep_nome_escola'],
        
        # Métricas
        'nota_tri_media': ['nota_tri_media', 'media_tri', 'nota_media', 'nota_padronizada'],
        'nota_media_5areas': ['nota_media_5areas', 'media_5areas', 'media_simples'],
        'ranking_brasil': ['ranking_brasil', 'ranking', 'rank', 'posicao'],
    }
    
    # Range válido para notas do ENEM
    NOTA_MIN = 0
    NOTA_MAX = 1000
    
    def __init__(self):
        self.validation_errors = []
        self.validation_warnings = []
    
    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normaliza nomes de colunas para padrão."""
        df = df.copy()
        new_columns = {}
        
        for col in df.columns:
            col_lower = col.lower().strip()
            found = False
            
            for standard_name, variants in self.COLUMN_MAPPING.items():
                if col in variants or col_lower in [v.lower() for v in variants]:
                    new_columns[col] = standard_name
                    found = True
                    break
            
            if not found:
                new_columns[col] = col_lower.replace(' ', '_')
        
        df.rename(columns=new_columns, inplace=True)
        return df
    
    def validate_dataframe(self, df: pd.DataFrame, ano: int) -> Dict:
        """Valida um DataFrame de dados ENEM."""
        self.validation_errors = []
        self.validation_warnings = []
        
        results = {
            "ano": ano,
            "total_registros": len(df),
            "colunas_presentes": list(df.columns),
            "colunas_requeridas_faltantes": [],
            "validacoes": {}
        }
        
        # Colunas obrigatórias
        required = ['codigo_inep', 'nome_escola']
        for col in required:
            if col not in df.columns:
                self.validation_errors.append(f"Coluna obrigatória faltante: {col}")
                results["colunas_requeridas_faltantes"].append(col)
        
        # Validação de notas
        nota_cols = ['nota_cn', 'nota_ch', 'nota_lc', 'nota_mt', 'nota_redacao']
        for col in nota_cols:
            if col in df.columns:
                invalid = df[
                    (df[col] < self.NOTA_MIN) | 
                    (df[col] > self.NOTA_MAX)
                ]
                if len(invalid) > 0:
                    self.validation_warnings.append(
                        f"{col}: {len(invalid)} valores fora do range ({self.NOTA_MIN}-{self.NOTA_MAX})"
                    )
        
        # Validação de duplicatas
        if 'codigo_inep' in df.columns:
            duplicates = df[df.duplicated(subset=['codigo_inep'], keep=False)]
            if len(duplicates) > 0:
                self.validation_warnings.append(
                    f"{len(duplicates)} códigos INEP duplicados"
                )
        
        # Validação de valores nulos
        null_counts = df.isnull().sum()
        high_null_cols = null_counts[null_counts > len(df) * 0.1]
        if len(high_null_cols) > 0:
            for col, count in high_null_cols.items():
                pct = count / len(df) * 100
                self.validation_warnings.append(
                    f"{col}: {count} valores nulos ({pct:.1f}%)"
                )
        
        results["errors"] = self.validation_errors
        results["warnings"] = self.validation_warnings
        results["is_valid"] = len(self.validation_errors) == 0
        
        return results


class ENEMIngestor:
    """Ingestor de dados ENEM para SQLite."""
    
    def __init__(self, db_path: str = "enem_unificado.db"):
        self.db_path = db_path
        self.validator = ENEMDataValidator()
        
    def create_unified_schema(self):
        """Cria schema unificado no banco."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS escolas_enem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ano INTEGER NOT NULL,
                codigo_inep TEXT NOT NULL,
                nome_escola TEXT,
                inep_nome TEXT,
                nota_tri_media REAL,
                ranking_brasil INTEGER,
                ranking_ano INTEGER,
                nota_cn REAL,
                nota_ch REAL,
                nota_lc REAL,
                nota_mt REAL,
                nota_redacao REAL,
                nota_media_5areas REAL,
                competencia_1 REAL,
                competencia_2 REAL,
                competencia_3 REAL,
                competencia_4 REAL,
                competencia_5 REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ano, codigo_inep)
            )
        """)
        
        # Índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ano ON escolas_enem(ano)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_inep ON escolas_enem(codigo_inep)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ranking ON escolas_enem(ranking_brasil)")
        
        # Tabela de metadados
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ingestao_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ano INTEGER NOT NULL,
                arquivo_origem TEXT,
                total_registros INTEGER,
                registros_inseridos INTEGER,
                registros_atualizados INTEGER,
                erros TEXT,
                data_ingestao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Schema criado em {self.db_path}")
    
    def ingest_csv(self, csv_path: str, ano: int, 
                   encoding: str = 'utf-8', 
                   sep: str = ',') -> Dict:
        """Ingere um CSV no banco unificado."""
        logger.info(f"📥 Ingerindo {csv_path} (ano {ano})...")
        
        # Lê CSV
        try:
            df = pd.read_csv(csv_path, encoding=encoding, sep=sep, low_memory=False)
        except UnicodeDecodeError:
            logger.warning("  Tentando encoding latin-1...")
            df = pd.read_csv(csv_path, encoding='latin-1', sep=sep, low_memory=False)
        
        logger.info(f"  {len(df)} registros lidos")
        
        # Normaliza colunas
        df = self.validator.normalize_columns(df)
        
        # Adiciona ano
        df['ano'] = ano
        
        # Valida
        validation = self.validator.validate_dataframe(df, ano)
        
        if not validation["is_valid"]:
            logger.error("❌ Validação falhou:")
            for error in validation["errors"]:
                logger.error(f"  - {error}")
            return validation
        
        if validation["warnings"]:
            logger.warning("⚠️  Avisos:")
            for warning in validation["warnings"]:
                logger.warning(f"  - {warning}")
        
        # Conecta ao banco
        conn = sqlite3.connect(self.db_path)
        
        # Verifica registros existentes
        cursor = conn.cursor()
        cursor.execute(
            "SELECT codigo_inep FROM escolas_enem WHERE ano = ?", 
            (ano,)
        )
        existing = set(row[0] for row in cursor.fetchall())
        
        # Separa inserções de atualizações
        if 'codigo_inep' in df.columns:
            df['exists'] = df['codigo_inep'].isin(existing)
            df_new = df[~df['exists']].drop(columns=['exists'])
            df_update = df[df['exists']].drop(columns=['exists'])
        else:
            df_new = df
            df_update = pd.DataFrame()
        
        # Seleciona apenas colunas do schema
        schema_cols = [
            'ano', 'codigo_inep', 'nome_escola', 'inep_nome',
            'nota_tri_media', 'ranking_brasil', 'ranking_ano',
            'nota_cn', 'nota_ch', 'nota_lc', 'nota_mt',
            'nota_redacao', 'nota_media_5areas',
            'competencia_1', 'competencia_2', 'competencia_3',
            'competencia_4', 'competencia_5'
        ]
        
        available_cols = [c for c in schema_cols if c in df.columns]
        
        # Insere novos registros
        if len(df_new) > 0:
            df_new[available_cols].to_sql(
                'escolas_enem', conn, if_exists='append', index=False
            )
            logger.info(f"  ✅ {len(df_new)} novos registros inseridos")
        
        # Atualiza existentes
        updated = 0
        if len(df_update) > 0 and 'codigo_inep' in df_update.columns:
            for _, row in df_update.iterrows():
                cursor.execute("""
                    UPDATE escolas_enem 
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE ano = ? AND codigo_inep = ?
                """, (ano, row['codigo_inep']))
                updated += cursor.rowcount
            logger.info(f"  🔄 {updated} registros atualizados")
        
        # Log da ingestão
        cursor.execute("""
            INSERT INTO ingestao_log 
            (ano, arquivo_origem, total_registros, registros_inseridos, 
             registros_atualizados, erros)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            ano, csv_path, len(df), len(df_new), updated,
            json.dumps(validation["warnings"]) if validation["warnings"] else None
        ))
        
        conn.commit()
        conn.close()
        
        logger.info(f"✅ Ingestão completa: {csv_path}")
        
        return {
            "ano": ano,
            "total": len(df),
            "inseridos": len(df_new),
            "atualizados": updated,
            "validation": validation
        }


def main():
    """Função principal."""
    parser = argparse.ArgumentParser(description='Ingestor ENEM 2025')
    parser.add_argument('csv', help='Arquivo CSV com dados')
    parser.add_argument('--ano', type=int, default=2025, help='Ano dos dados')
    parser.add_argument('--db', default='enem_unificado.db', help='Banco de destino')
    parser.add_argument('--encoding', default='utf-8', help='Encoding do CSV')
    parser.add_argument('--sep', default=',', help='Separador do CSV')
    
    args = parser.parse_args()
    
    # Cria ingestor
    ingestor = ENEMIngestor(args.db)
    
    # Cria schema se não existir
    ingestor.create_unified_schema()
    
    # Ingere dados
    result = ingestor.ingest_csv(
        args.csv, 
        args.ano,
        encoding=args.encoding,
        sep=args.sep
    )
    
    print("\n" + "=" * 60)
    print("RESUMO DA INGESTÃO")
    print("=" * 60)
    print(f"Ano: {result['ano']}")
    print(f"Total: {result['total']}")
    print(f"Inseridos: {result['inseridos']}")
    print(f"Atualizados: {result['atualizados']}")
    print("=" * 60)


if __name__ == "__main__":
    import json
    main()
