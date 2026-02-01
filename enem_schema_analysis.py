"""
Análise de Schema e Preparação para ENEM 2025
============================================

Este script analisa a estrutura atual dos dados e prepara
a migração para receber dados do ENEM 2025.
"""

import sqlite3
import pandas as pd
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Optional
import json


@dataclass
class ColumnInfo:
    """Informações sobre uma coluna."""
    name: str
    dtype: str
    nullable: bool = True
    description: str = ""


@dataclass
class TableSchema:
    """Schema de uma tabela."""
    name: str
    columns: List[ColumnInfo]
    primary_key: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "columns": [{"name": c.name, "dtype": c.dtype, "nullable": c.nullable, "description": c.description} for c in self.columns],
            "primary_key": self.primary_key
        }


class ENEMSchemaAnalyzer:
    """Analisador de schema dos dados ENEM."""
    
    # Schema esperado para dados ENEM (baseado em 2024)
    EXPECTED_COLUMNS = {
        "codigo_inep": "TEXT",
        "nome_escola": "TEXT", 
        "inep_nome": "TEXT",
        "nota_tri_media": "REAL",
        "ranking_brasil": "INTEGER",
        "nota_cn": "REAL",  # Ciências da Natureza
        "nota_ch": "REAL",  # Ciências Humanas
        "nota_lc": "REAL",  # Linguagens e Códigos
        "nota_mt": "REAL",  # Matemática
        "nota_redacao": "REAL",
        "nota_media_5areas": "REAL",
        "competencia_1": "REAL",
        "competencia_2": "REAL",
        "competencia_3": "REAL",
        "competencia_4": "REAL",
        "competencia_5": "REAL",
        "ano": "INTEGER",
    }
    
    def __init__(self, db_path: str = "enem_2024.db"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        
    def analyze_current_schema(self) -> Dict[str, TableSchema]:
        """Analisa o schema atual do banco."""
        cursor = self.conn.cursor()
        
        # Pega todas as tabelas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        schemas = {}
        for (table_name,) in tables:
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns_info = cursor.fetchall()
            
            columns = []
            primary_key = None
            for col in columns_info:
                cid, name, dtype, notnull, dflt_value, pk = col
                columns.append(ColumnInfo(
                    name=name,
                    dtype=dtype,
                    nullable=not bool(notnull)
                ))
                if pk:
                    primary_key = name
            
            schemas[table_name] = TableSchema(
                name=table_name,
                columns=columns,
                primary_key=primary_key
            )
        
        return schemas
    
    def analyze_csv_structure(self, csv_path: str) -> List[str]:
        """Analisa a estrutura de um CSV."""
        df = pd.read_csv(csv_path, nrows=5)
        return list(df.columns)
    
    def check_compatibility(self, csv_path: str) -> Dict:
        """Verifica compatibilidade de um CSV com o schema esperado."""
        df = pd.read_csv(csv_path, nrows=5)
        csv_columns = set(df.columns)
        expected_columns = set(self.EXPECTED_COLUMNS.keys())
        
        return {
            "csv_path": csv_path,
            "columns_present": list(csv_columns),
            "columns_missing": list(expected_columns - csv_columns),
            "columns_extra": list(csv_columns - expected_columns),
            "is_compatible": csv_columns >= expected_columns
        }
    
    def generate_migration_script(self, output_path: str = "enem_migration_2025.sql"):
        """Gera script SQL para migrar para schema unificado."""
        script = """-- Migração ENEM: Schema Unificado para múltiplos anos
-- Gerado automaticamente

-- Tabela principal unificada
CREATE TABLE IF NOT EXISTS escolas_enem_unificado (
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
    
    -- Índices para performance
    UNIQUE(ano, codigo_inep)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_escolas_ano ON escolas_enem_unificado(ano);
CREATE INDEX IF NOT EXISTS idx_escolas_inep ON escolas_enem_unificado(codigo_inep);
CREATE INDEX IF NOT EXISTS idx_escolas_ranking ON escolas_enem_unificado(ranking_brasil);
CREATE INDEX IF NOT EXISTS idx_escolas_nota ON escolas_enem_unificado(nota_tri_media);

-- View para rankings comparativos
CREATE VIEW IF NOT EXISTS v_ranking_comparativo AS
SELECT 
    codigo_inep,
    nome_escola,
    MAX(CASE WHEN ano = 2024 THEN ranking_brasil END) as rank_2024,
    MAX(CASE WHEN ano = 2023 THEN ranking_brasil END) as rank_2023,
    MAX(CASE WHEN ano = 2022 THEN ranking_brasil END) as rank_2022,
    MAX(CASE WHEN ano = 2024 THEN nota_tri_media END) as nota_2024,
    MAX(CASE WHEN ano = 2023 THEN nota_tri_media END) as nota_2023,
    MAX(CASE WHEN ano = 2022 THEN nota_tri_media END) as nota_2022
FROM escolas_enem_unificado
GROUP BY codigo_inep, nome_escola;

-- Tabela de metadados por ano
CREATE TABLE IF NOT EXISTS enem_metadados (
    ano INTEGER PRIMARY KEY,
    total_escolas INTEGER,
    nota_media_nacional REAL,
    data_ingestao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    arquivo_fonte TEXT,
    observacoes TEXT
);
"""
        
        with open(output_path, 'w') as f:
            f.write(script)
        
        print(f"✅ Script de migração gerado: {output_path}")
        return output_path
    
    def close(self):
        """Fecha conexão com o banco."""
        self.conn.close()


def main():
    """Função principal."""
    print("=" * 60)
    print("ANÁLISE DE SCHEMA ENEM - PREPARAÇÃO 2025")
    print("=" * 60)
    
    analyzer = ENEMSchemaAnalyzer()
    
    # Analisa schema atual
    print("\n📊 Schema atual do banco:")
    schemas = analyzer.analyze_current_schema()
    for table_name, schema in schemas.items():
        print(f"\n  Tabela: {table_name}")
        for col in schema.columns:
            pk_marker = " (PK)" if col.name == schema.primary_key else ""
            print(f"    - {col.name}: {col.dtype}{pk_marker}")
    
    # Analisa CSVs
    print("\n📁 Analisando arquivos CSV:")
    csv_files = [
        "enem_2024_completo.csv",
        "enem_2018_2024_completo.csv"
    ]
    
    for csv_file in csv_files:
        if Path(csv_file).exists():
            compat = analyzer.check_compatibility(csv_file)
            print(f"\n  {csv_file}:")
            print(f"    Colunas: {len(compat['columns_present'])}")
            if compat['columns_missing']:
                print(f"    ⚠️  Faltando: {compat['columns_missing']}")
            if compat['columns_extra']:
                print(f"    ➕ Extras: {compat['columns_extra']}")
            if compat['is_compatible']:
                print(f"    ✅ Compatível com schema esperado")
    
    # Gera script de migração
    print("\n📝 Gerando script de migração...")
    analyzer.generate_migration_script()
    
    analyzer.close()
    print("\n" + "=" * 60)
    print("Análise completa!")
    print("=" * 60)


if __name__ == "__main__":
    main()
