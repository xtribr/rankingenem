# Ranking ENEM Analytics

Plataforma da XTRI para análise de desempenho escolar no ENEM.

## Arquitetura ativa

- Frontend: Next.js em `enem-analytics/frontend`
- Backend: FastAPI em `enem-analytics/backend`
- Autenticação: Supabase Auth
- Banco principal: Supabase Postgres
- Modelos e análises: scikit-learn + GLiNER

## Estrutura

```text
enem-analytics/
├── backend/
│   ├── api/
│   ├── data/
│   ├── ml/
│   ├── scripts/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   └── Dockerfile
└── README.md
```

## Deploy com Docker no Coolify

### Backend

- Build Pack: `Dockerfile`
- Base Directory: `/enem-analytics/backend`
- Dockerfile Location: `/Dockerfile`
- Port Expose: `8080`

Variáveis de ambiente obrigatórias:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Variáveis opcionais:

```env
PIONEER_API_KEY=your-pioneer-key
RESEND_API_KEY=your-resend-key
```

### Frontend

- Build Pack: `Dockerfile`
- Base Directory: `/enem-analytics/frontend`
- Dockerfile Location: `/Dockerfile`
- Port Expose: `3000`

Variáveis de ambiente:

```env
NEXT_PUBLIC_API_URL=https://api.rankingenem.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`NEXT_PUBLIC_*` entra no build do Next.js. Mudou qualquer uma delas, precisa redeploy do frontend.

## Desenvolvimento local

### Backend

```bash
cd enem-analytics/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-prod.txt
uvicorn api.main:app --reload --port 8000
```

### Frontend

```bash
cd enem-analytics/frontend
pnpm install
pnpm dev
```

## Autenticação

- O login é feito no frontend diretamente pelo Supabase Auth.
- A API valida o access token do Supabase via header `Authorization: Bearer ...`.
- O endpoint de perfil autenticado é `GET /api/auth/me`.
- Não existe mais login JWT próprio da API.

### Bootstrap do primeiro admin

Opcionalmente, crie o admin inicial via script:

```bash
cd enem-analytics/backend
python scripts/create_admin.py admin@xtri.online senha123 "Admin X-TRI"
```

Pré-requisitos:

- `SUPABASE_URL` configurada
- `SUPABASE_SERVICE_KEY` configurada
- tabela `profiles` já criada no Supabase

## Fluxos principais

- Admin: dashboard, ranking, comparação, tendências, oráculo e gestão de usuários
- Escola: visão da própria escola e roadmap

## Endpoints principais

### Auth

- `GET /api/auth/me`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/{user_id}`
- `DELETE /api/admin/users/{user_id}`
- `GET /api/admin/stats`

### Core

- `GET /api/schools`
- `GET /api/schools/{codigo_inep}`
- `GET /api/predictions/{codigo_inep}`
- `GET /api/diagnosis/{codigo_inep}`
- `GET /api/clusters/{codigo_inep}/cluster`
- `GET /api/recommendations/{codigo_inep}`

## Observações operacionais

- Alterações de env no backend exigem redeploy do backend.
- Alterações de env `NEXT_PUBLIC_*` exigem redeploy do frontend.
- O frontend e o backend são deploys separados no Coolify.
