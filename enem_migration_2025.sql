-- Migração ENEM: Schema Unificado para múltiplos anos
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
