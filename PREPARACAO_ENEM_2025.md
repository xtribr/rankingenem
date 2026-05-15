# Preparacao para Dados ENEM 2025

Este documento descreve o processo de preparacao e ingestao dos dados do ENEM 2025.

> **Status (maio 2026):** Os microdados do ENEM 2025 ainda NAO foram publicados pelo INEP.
> O ano mais recente disponivel em https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem e **2024**.
> Este documento prepara o pipeline para quando os dados forem liberados.

## Pre-requisitos

Antes de qualquer ingestao, o banco unificado precisa existir.

### 1. Banco legado vs. banco unificado

| Banco | Tabela | Descricao |
|-------|--------|-----------|
| `enem_2024.db` | `escolas` | Banco legado, schema com tipos TEXT e nomes nao-normalizados |
| `enem_unificado.db` | `escolas_enem_unificado` | Banco multi-ano com schema normalizado (criado pela migracao) |

O ingestor (`enem_ingestor_2025.py`) grava em `enem_unificado.db` por padrao. O banco legado `enem_2024.db` nao e compativel diretamente.

### 2. Executar a migracao

```bash
# Criar o banco unificado com schema, indices e views
sqlite3 enem_unificado.db < enem_migration_2025.sql
```

Isso cria:
- Tabela `escolas_enem_unificado` com constraint `UNIQUE(ano, codigo_inep)`
- Indices em `ano`, `codigo_inep`, `ranking_brasil`, `nota_tri_media`
- View `v_ranking_comparativo` para comparar anos lado a lado
- Tabela `enem_metadados` para log de ingestao

## Estrutura de Dados

### Schema Unificado (`escolas_enem_unificado`)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | INTEGER | Chave primaria (autoincrement) |
| `ano` | INTEGER | Ano da avaliacao (NOT NULL) |
| `codigo_inep` | TEXT | Codigo INEP da escola (NOT NULL) |
| `nome_escola` | TEXT | Nome da escola |
| `inep_nome` | TEXT | Codigo + Nome (formato legado) |
| `nota_tri_media` | REAL | Media TRI (nota principal) |
| `ranking_brasil` | INTEGER | Posicao no ranking nacional |
| `ranking_ano` | INTEGER | Ranking dentro do ano |
| `nota_cn` | REAL | Ciencias da Natureza |
| `nota_ch` | REAL | Ciencias Humanas |
| `nota_lc` | REAL | Linguagens e Codigos |
| `nota_mt` | REAL | Matematica |
| `nota_redacao` | REAL | Redacao |
| `nota_media_5areas` | REAL | Media das 5 areas |
| `competencia_1` | REAL | Competencia 1 da redacao |
| `competencia_2` | REAL | Competencia 2 da redacao |
| `competencia_3` | REAL | Competencia 3 da redacao |
| `competencia_4` | REAL | Competencia 4 da redacao |
| `competencia_5` | REAL | Competencia 5 da redacao |
| `created_at` | TIMESTAMP | Data de insercao |
| `updated_at` | TIMESTAMP | Data de atualizacao |

## Processo de Ingestao

### 1. Validacao do Arquivo

Antes de ingerir, analise a estrutura atual e o CSV:

```bash
# Analisar schema do banco e CSVs existentes
python enem_schema_analysis.py

# Verificar compatibilidade de um CSV especifico
python -c "
from enem_schema_analysis import ENEMSchemaAnalyzer
analyzer = ENEMSchemaAnalyzer()
print(analyzer.check_compatibility('microdados_enem_2025.csv'))
analyzer.close()
"
```

### 2. Ingestao dos Dados

```bash
# Ingerir dados do ENEM 2025 (banco padrao: enem_unificado.db)
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025

# Se o encoding for diferente
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025 --encoding latin-1

# Se o separador for diferente (ex: ponto-e-virgula nos microdados INEP)
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025 --encoding latin-1 --sep ";"

# Para gravar em banco especifico
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025 --db enem_unificado.db
```

### 3. Validacao Cruzada

```bash
# Gerar relatorio comparativo
python enem_comparador_anual.py --db enem_unificado.db
```

**Atencao:** O comparador busca a tabela `escolas_enem` (via query `WHERE ano = ?`). Se voce usou a migracao que cria `escolas_enem_unificado`, sera necessario criar um alias ou ajustar o comparador para usar o nome correto da tabela.

## Pontos de Atencao

### Mapeamento de Colunas

O ingestor normaliza automaticamente variacoes de nomes de colunas:

| Variacoes Aceitas | Coluna Padrao |
|-------------------|---------------|
| `Redacao`, `redacao`, `nota_redacao`, `nota_redacao` | `nota_redacao` |
| `Competencia 1`, `competencia_1`, `comp1`, `c1` | `competencia_1` |
| `nota_cn`, `ciencias_natureza`, `nota_ciencias_natureza`, `cn` | `nota_cn` |
| `nota_ch`, `ciencias_humanas`, `nota_ciencias_humanas`, `ch` | `nota_ch` |
| `nota_lc`, `linguagens`, `nota_linguagens`, `lc` | `nota_lc` |
| `nota_mt`, `matematica`, `nota_matematica`, `mt` | `nota_mt` |

### Validacoes Automaticas

- **Range de notas**: 0-1000
- **Duplicatas**: Detecta codigos INEP duplicados
- **Valores nulos**: Alerta se >10% de valores ausentes
- **Colunas obrigatorias**: `codigo_inep`, `nome_escola`

### Incompatibilidade: banco legado (`enem_2024.db`)

O banco legado tem problemas de tipos que o schema unificado corrige:

| Coluna | Legado (`escolas`) | Unificado (`escolas_enem_unificado`) |
|--------|--------------------|--------------------------------------|
| `nota_tri_media` | TEXT | REAL |
| `ranking_brasil` | TEXT | INTEGER |
| `Redacao` (com acento) | REAL | `nota_redacao` REAL |
| `Competencia 1` (com espaco) | TEXT | `competencia_1` REAL |
| `ano` | nao existe | INTEGER NOT NULL |

## Analises Disponiveis

Apos a ingestao, voce pode executar:

### Comparativo Anual

```python
from enem_comparador_anual import ENEMComparadorAnual

comp = ENEMComparadorAnual('enem_unificado.db')
df = comp.get_resumo_anual(2024)
print(df)
```

### Deteccao de Anomalias

```python
anomalias = comp.detectar_anomalias_2025(ano_base=2024, ano_novo=2025)
print(anomalias)
```

## Arquivos do Pipeline

| Arquivo | Descricao |
|---------|-----------|
| `enem_schema_analysis.py` | Analisa schema atual e gera script de migracao |
| `enem_ingestor_2025.py` | Ingestor com validacao e normalizacao |
| `enem_comparador_anual.py` | Comparador entre anos |
| `enem_migration_2025.sql` | Script SQL de migracao (gerado por `enem_schema_analysis.py`) |
| `enem_unificado.db` | Banco SQLite unificado (criado apos migracao) |
| `enem_2024.db` | Banco legado (somente tabela `escolas`, sem coluna `ano`) |

## Checklist de Ingestao

- [ ] Microdados ENEM 2025 publicados pelo INEP
- [ ] Arquivo CSV baixado de https://download.inep.gov.br/microdados/microdados_enem_2025.zip
- [ ] Encoding verificado (UTF-8 ou Latin-1)
- [ ] `enem_migration_2025.sql` executado (`sqlite3 enem_unificado.db < enem_migration_2025.sql`)
- [ ] Estrutura de colunas validada (`python enem_schema_analysis.py`)
- [ ] Backup do banco atual criado
- [ ] Ingestao executada sem erros
- [ ] Relatorio de validacao gerado (`python enem_comparador_anual.py`)
- [ ] Anomalias investigadas (se houver)
- [ ] Tabela `escolas_enem` vs `escolas_enem_unificado` reconciliada no comparador

## Problemas Conhecidos

1. **Comparador usa tabela `escolas_enem`** mas a migracao cria `escolas_enem_unificado`. Precisa de ajuste no `enem_comparador_anual.py:32`.
2. **Dados legados em `enem_2024.db`** precisam ser migrados para o banco unificado com conversao de tipos (TEXT -> REAL/INTEGER).
3. **View `v_ranking_comparativo`** so compara 2022-2024. Adicionar 2025 apos ingestao.

---

*Ultima atualizacao: Maio 2026*
