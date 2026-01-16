# XTRI Claude Code Agents

Sistema de agentes especializados para desenvolvimento da plataforma XTRI.

## Instalação

Copie a pasta `agents/` para `.claude/agents/` na raiz do seu projeto:

```bash
# Na raiz do seu projeto XTRI
mkdir -p .claude/agents
cp -r agents/* .claude/agents/
```

Ou simplesmente:

```bash
cp -r agents/ .claude/
```

## Estrutura

```
.claude/
└── agents/
    ├── orchestrator.md       # Coordenador principal (opus)
    ├── tri-analyst.md        # Especialista TRI (sonnet)
    ├── enem-validator.md     # Validador ENEM (sonnet)
    ├── data-auditor.md       # Auditor de dados (sonnet)
    └── supabase-specialist.md # Expert Supabase (sonnet)
```

## Agentes Disponíveis

### orchestrator (opus)
Coordenador principal para tarefas complexas. Use para:
- Tarefas que envolvem múltiplos módulos
- Refatoração de código
- Novas features
- Arquitetura de sistema

### tri-analyst (sonnet)
Especialista em Teoria de Resposta ao Item. Use para:
- Validação de cálculos de score
- Estimativa de theta
- Análise psicométrica
- Verificação de fórmulas TRI

### enem-validator (sonnet)
Validador de questões ENEM. Use para:
- Criação de questões
- Validação de banco de questões
- Verificação de matriz de competências
- Qualidade de distratores

### data-auditor (sonnet)
Auditor de dados educacionais. Use para:
- Importação de dados
- Verificação de integridade
- Detecção de anomalias
- Compliance LGPD

### supabase-specialist (sonnet)
Expert em Supabase/PostgreSQL. Use para:
- Design de schema
- Políticas RLS
- Otimização de queries
- Migrations

## Uso

No Claude Code, os agentes são invocados automaticamente pelo orchestrator conforme a necessidade, ou você pode chamar diretamente:

```
Use o tri-analyst para verificar este cálculo de score...
Use o data-auditor para validar esta importação...
```

## Stack do Projeto

- **Frontend:** React + Tailwind CSS (Vercel)
- **Backend:** Node.js (Fly.io)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth

## Contexto

Plataforma educacional XTRI focada em preparação para o ENEM usando metodologia TRI.
- ~5,000 usuários
- ~190,000 registros educacionais
- Alta responsabilidade (dados impactam futuro dos alunos)
