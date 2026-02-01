# Preparação para Dados ENEM 2025

Este documento descreve o processo de preparação e ingestão dos dados do ENEM 2025.

## 📊 Estrutura de Dados

### Schema Unificado

O schema unificado suporta múltiplos anos com as seguintes colunas:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `ano` | INTEGER | Ano da avaliação |
| `codigo_inep` | TEXT | Código INEP da escola |
| `nome_escola` | TEXT | Nome da escola |
| `inep_nome` | TEXT | Código + Nome (formato legado) |
| `nota_tri_media` | REAL | Média TRI (nota principal) |
| `ranking_brasil` | INTEGER | Posição no ranking nacional |
| `nota_cn` | REAL | Ciências da Natureza |
| `nota_ch` | REAL | Ciências Humanas |
| `nota_lc` | REAL | Linguagens e Códigos |
| `nota_mt` | REAL | Matemática |
| `nota_redacao` | REAL | Redação |
| `competencia_1` | REAL | Competência 1 da redação |
| `competencia_2` | REAL | Competência 2 da redação |
| `competencia_3` | REAL | Competência 3 da redação |
| `competencia_4` | REAL | Competência 4 da redação |
| `competencia_5` | REAL | Competência 5 da redação |

## 🚀 Processo de Ingestão

### 1. Validação do Arquivo

Antes de ingerir, verifique o arquivo CSV:

```bash
# Analisar estrutura
python enem_schema_analysis.py

# Verificar compatibilidade
python -c "
import pandas as pd
df = pd.read_csv('microdados_enem_2025.csv', nrows=5)
print('Colunas:', df.columns.tolist())
print('Formato:', df.shape)
"
```

### 2. Ingestão dos Dados

```bash
# Ingerir dados do ENEM 2025
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025

# Se o encoding for diferente
python enem_ingestor_2025.py microdados_enem_2025.csv --ano 2025 --encoding latin-1
```

### 3. Validação Cruzada

```bash
# Gerar relatório comparativo
python enem_comparador_anual.py --db enem_unificado.db
```

## ⚠️ Pontos de Atenção

### Mapeamento de Colunas

O sistema normaliza automaticamente variações de nomes de colunas:

| Variações Aceitas | Coluna Padrão |
|-------------------|---------------|
| `Redação`, `redação`, `redacao` | `nota_redacao` |
| `Competência 1`, `comp1`, `c1` | `competencia_1` |
| `nota_cn`, `ciencias_natureza`, `cn` | `nota_cn` |

### Validações Automáticas

- **Range de notas**: 0-1000
- **Duplicatas**: Detecta códigos INEP duplicados
- **Valores nulos**: Alerta se >10% de valores ausentes
- **Colunas obrigatórias**: `codigo_inep`, `nome_escola`

## 📈 Análises Disponíveis

Após a ingestão, você pode executar:

### Comparativo Anual
```python
from enem_comparador_anual import ENEMComparadorAnual

comp = ENEMComparadorAnual('enem_unificado.db')
df = comp.comparar_anos([2022, 2023, 2024, 2025])
print(df)
```

### Detecção de Anomalias
```python
anomalias = comp.detectar_anomalias_2025(ano_base=2024, ano_novo=2025)
print(anomalias)
```

## 🗂️ Arquivos Gerados

| Arquivo | Descrição |
|---------|-----------|
| `enem_unificado.db` | Banco SQLite com todos os anos |
| `enem_migration_2025.sql` | Script SQL de migração |
| `relatorio_enem_2025.md` | Relatório de análise |

## 🔍 Checklist de Ingestão

- [ ] Arquivo CSV recebido do INEP
- [ ] Encoding verificado (UTF-8 ou Latin-1)
- [ ] Estrutura de colunas validada
- [ ] Backup do banco atual criado
- [ ] Ingestão executada sem erros
- [ ] Relatório de validação gerado
- [ ] Anomalias investigadas (se houver)
- [ ] Views e índices atualizados

## 📞 Suporte

Em caso de problemas:

1. Verifique logs de ingestão
2. Execute `enem_schema_analysis.py` para diagnóstico
3. Consulte a tabela `ingestao_log` no banco SQLite

---

*Última atualização: Janeiro 2026*
