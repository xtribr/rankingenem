# Design: Comparativo de Escolas Avançado

**Data:** 2026-01-05
**Status:** Aprovado
**Autor:** Claude + Usuario

---

## Objetivo

Melhorar a funcionalidade de comparação de escolas para coordenadores e escolas clientes que desejam:
- Comparar sua escola com concorrentes locais
- Entender onde ganham/perdem em relação a benchmarks da região
- Identificar oportunidades de melhoria

---

## Funcionalidades

### 1. Cards de Resumo (Placar Geral)
- Nota atual de cada escola
- Tendência de crescimento (pts/ano)
- Posição no ranking Brasil
- Indicador visual de "ganha em" por área

### 2. Gráficos de Comparação por Área
- **Radar Chart:** 5 áreas (CN, CH, LC, MT, Redação) sobrepostas
- **Bar Chart Horizontal:** Barras lado a lado com diferença destacada
- **Linha de referência:** TOP Brasil (dourado) como teto

### 3. Evolução Histórica e Tendências
- Gráfico de linhas 2018-2024
- Cards de tendência (crescimento total, pts/ano, melhor/pior ano)
- Insight automático: "Escola X cresce Y% mais rápido"

### 4. Análise de Pontos Fortes e Fracos
- Painel dividido: "Você ganha em" vs "Você perde em"
- Classificação de vantagem: ALTA, MODERADA, EMPATE
- Recomendação estratégica automática

### 5. Rankings e Posição Relativa
- Ranking Brasil, Estado, Mesmo Porte, Tipo de escola
- Visualização gauge/termômetro
- Contexto: "Supera X% das escolas"

### 6. Sugestão de Escolas Similares
- Benchmarks (melhores do perfil)
- Concorrentes diretos (±50 posições)
- Casos de sucesso (melhoraram +50pts)
- Clique para comparar

### 7. Exportação PDF
- Modal de seleção de seções
- Formatos: PDF ou PNG
- Marca d'água X-TRI opcional
- Tecnologia: html2pdf.js (client-side)

---

## Arquitetura da Página

```
┌─────────────────────────────────────────────────────────────┐
│  COMPARAR ESCOLAS                        [📄 Exportar PDF]  │
├─────────────────────────────────────────────────────────────┤
│  [Buscar Escola 1...]        [Buscar Escola 2...]           │
│                                                             │
│  ┌─── SUGESTÕES ───────────────────────────────────────┐    │
│  │ 🏆 Benchmarks  🎯 Concorrentes  📈 Casos de Sucesso │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ CARDS DE RESUMO                                        │
│  2️⃣ GRÁFICOS DE ÁREA (radar + barras)                      │
│  3️⃣ EVOLUÇÃO HISTÓRICA                                     │
│  4️⃣ ANÁLISE COMPETITIVA                                    │
│  5️⃣ RANKINGS                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Endpoints Utilizados

| Endpoint | Status | Uso |
|----------|--------|-----|
| `/api/schools/compare/{inep1}/{inep2}` | ✅ Existe | Dados básicos e histórico |
| `/api/diagnosis/compare/{inep1}/{inep2}` | ✅ Existe | Análise por área e status |
| `/api/schools/{inep}/history` | ✅ Existe | Evolução histórica detalhada |
| `/api/clusters/{inep}/similar` | ✅ Existe | Escolas similares |
| `/api/clusters/{inep}/similar-improved` | ✅ Existe | Casos de sucesso |
| `/api/schools/top?limit=1` | ✅ Existe | TOP nacional (referência) |

---

## Tecnologias

- **Gráficos:** recharts (já instalado)
- **PDF:** html2pdf.js (a instalar)
- **Estilos:** Tailwind CSS (já usado)
- **Estado:** React Query (já usado)

---

## Cores e Visual

- **Escola 1:** Azul (#3b82f6)
- **Escola 2:** Verde (#22c55e)
- **TOP Brasil:** Dourado (#f59e0b)
- **Vantagem:** Cor da escola que ganha
- **Empate:** Cinza (#6b7280)

---

## Implementação

### Fase 1: Estrutura Base
- Refatorar page.tsx com novo layout
- Adicionar hooks para novos endpoints

### Fase 2: Componentes de Visualização
- SummaryCards
- RadarComparison
- BarComparison
- EvolutionChart
- CompetitiveAnalysis
- RankingComparison

### Fase 3: Sugestões e Extras
- SimilarSchoolsSuggestions
- PDFExport modal

---

## Aprovado por

Usuario em 2026-01-05
