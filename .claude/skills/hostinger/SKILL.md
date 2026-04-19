---
name: hostinger
description: Hostinger/Coolify deployment operations for this repo — trigger deploys, manage webhooks, inspect build state, and troubleshoot auto-deploy issues for ranking-enem-api and ranking-enem-web. Use whenever the user asks about deploys, pushing to production, Coolify, hostinger, webhooks, VPS, build failures, or env vars not taking effect.
---

# Hostinger / Coolify deploy playbook

Production for this repo runs on a Hostinger KVM 4 VPS with Coolify orchestrating two Docker apps. Both apps live under the `ranking-enem` project inside Coolify.

## Key coordinates

| Item | Value |
|---|---|
| VPS OS | Ubuntu 24.04 (KVM 4) |
| VPS IP | `212.85.19.50` |
| SSH | `ssh -p 65002 u314125247@76.13.90.190` (Hostinger's tunnel) or `ssh root@212.85.19.50` (direct) |
| Coolify UI | `http://212.85.19.50:8000` |
| GitHub repo | `xtribr/rankingenem` (public) |
| Deploy branch | `main` |

### Applications

| Coolify app | Role | Public URL | Base Directory | Dockerfile |
|---|---|---|---|---|
| `ranking-enem-api` | FastAPI backend | `https://api.rankingenem.com` | `/enem-analytics/backend` | `/Dockerfile` |
| `ranking-enem-web` | Next.js frontend | `https://app.rankingenem.com` | `/enem-analytics/frontend` | `/Dockerfile` |

Both apps:
- Source: **Public GitHub** (not GitHub App) — so auto-deploy uses **manual webhooks**, not native Coolify GitHub integration.
- Auto Deploy: **ON** (verify in app → **Advanced** tab).
- Watch Paths: **not available** in this Coolify version (`v4.0.0-beta.462`). Base Directory + Docker layer cache mitigate cross-rebuilds — the "unchanged" app rebuilds in ~20-40s on cache hits.

## Auto-deploy architecture

```
git push origin main
      ↓
GitHub fires webhook  ×2  (one per Coolify app)
      ↓
http://212.85.19.50:8000/webhooks/source/github/events/manual
      ↓
Coolify validates secret → pulls → rebuilds Docker image → redeploys container
```

**Each app has its own GitHub webhook with its own secret.** They share the same URL. Coolify routes each delivery to the correct app by matching the secret.

### Webhook config (GitHub side)

For both webhooks in `github.com/xtribr/rankingenem/settings/hooks`:
- **Payload URL**: `http://212.85.19.50:8000/webhooks/source/github/events/manual`
- **Content type**: `application/json` (not form-urlencoded)
- **Secret**: the value in the corresponding Coolify app's **Webhooks** tab → "GitHub Webhook Secret" field
- **SSL verification**: Disabled (HTTP, no cert on the VPS IP)
- **Events**: "Just the push event"

## Routine operations

### Push a change
```bash
cd "/Volumes/KINGSTON/apps/apps/RANKING ENEM"
git add -A
git status                                # sanity-check file list
git commit -m "<conventional commit message>"
git push origin main
```
Both apps start building within ~5s. Watch each app's **Deployments** tab in Coolify.

### Manually trigger a redeploy (bypass git)
Each app also has a **"Deploy Webhook (auth required)"** URL in its Webhooks tab, e.g.
```
https://<coolify-host>/api/v1/deploy?uuid=<app-uuid>&force=false
```
Call it with the Coolify API token. Useful for:
- Redeploying without a new commit
- Scripted deploys from CI
- Forcing a rebuild after changing env vars that bake in at build time

### Verify the pipeline end-to-end
```bash
# Does Coolify answer on the webhook URL?
curl -sI http://212.85.19.50:8000/webhooks/source/github/events/manual | head -1
# Expect: HTTP/1.1 302 Found  (302 = Coolify is alive; 404 = wrong URL)

# Does Coolify's API answer?
curl -sI http://212.85.19.50:8000/ | head -1
```

## ⚠️ Gotchas that bite

### `NEXT_PUBLIC_*` are build-time, not runtime
Any env var prefixed `NEXT_PUBLIC_` is baked into the compiled Next.js bundle. Changing it in Coolify and clicking **Restart** does nothing — you must click **Redeploy** (or push any commit) so the build re-runs.

Required frontend env vars:
```
NEXT_PUBLIC_API_URL=https://api.rankingenem.com
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<real-anon-key>
```

### Backend required env vars
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<real-service-role-key>
# Optional:
PIONEER_API_KEY=<pioneer-key>
RESEND_API_KEY=<resend-key>
```

Missing `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` → container fails on startup (`init_database` raises) → deployment marked Failed.

### Production vs. local Supabase drift
This repo has been developed against a **local** Supabase (via Docker). Several DB objects exist only locally and must be mirrored to production Supabase before the corresponding features work in production:

- `public.get_enem_stats()` RPC → powers the dashboard "Médias Nacionais" + top-level stats
- `public.enem_results` columns: `desempenho_habilidades`, `competencia_redacao_media`, `nota_tri_media`, `anos_participacao`, `localizacao`, `porte`, `porte_label`, `ranking_uf`
- `public.profiles.is_active` column
- `public.school_skills` table (empty skeleton — created to prevent 500s)

Before any production deploy touching these paths, verify the production Supabase matches via Supabase SQL editor or generate a migration from the local state.

### Monorepo rebuild cost
Without Watch Paths, every push triggers **both** webhooks. Acceptable because:
- Base Directory scopes the build context per app.
- Docker layer cache hits when no files in that context changed — rebuild completes in ~20-40s.

Only a real change inside the app's base directory results in a full rebuild.

### CORS in the backend
`api/main.py` maintains an explicit `allow_origins` list. If you add a new frontend URL (preview deploy, new env, etc.), add it to that list and redeploy the API. The regex `allow_origin_regex` also matches `frontend-[a-z0-9-]+\.vercel\.app` for preview URLs.

## Troubleshooting

### Webhook delivery shows 404 in GitHub
Coolify's "Instance URL" setting is misconfigured and Coolify generated the wrong webhook URL. Verify:
```bash
curl -sI http://212.85.19.50:8000/webhooks/source/github/events/manual | head -1
```
Expect `302`. If you get `404`, the URL is wrong. Current confirmed-working URL is `http://212.85.19.50:8000/webhooks/source/github/events/manual`. Replace `rankingenem.com` in any generated URL with the IP.

### Webhook delivery shows 401/403
Secret mismatch. Copy the secret from Coolify's **Webhooks** tab (eye icon to reveal) and paste it into the GitHub webhook's **Secret** field.

### Build failed with pandas/numpy/scipy error
Version bounds in `requirements.txt` / `requirements-prod.txt` may conflict with pinned versions. Adjust the bounds and push.

### Build succeeded but site is broken
- Frontend: likely a `NEXT_PUBLIC_*` env var missing or wrong. Redeploy (not restart) after fixing.
- Backend: check the container logs in Coolify (app → **Logs** tab). Most crashes happen in `lifespan` / `init_database`.

### `/api/stats` returns 500 in production
The `get_enem_stats` RPC is missing from production Supabase. Create it — see [supabase-migrations.sql](./supabase-migrations.sql) in this skill folder.

### "Invalid JWT" on login
The frontend's `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were baked from wrong values. Update in Coolify env, then **Redeploy** the web app.

## Useful one-liners

```bash
# Tail the API container logs (SSH required)
ssh root@212.85.19.50 'docker logs -f $(docker ps -q --filter name=ranking-enem-api)'

# Force a rebuild of the API without a git commit
curl -X GET "http://212.85.19.50:8000/api/v1/deploy?uuid=<api-uuid>&force=true" \
     -H "Authorization: Bearer <coolify-api-token>"

# Confirm both apps are healthy
curl -s https://api.rankingenem.com/health
curl -sI https://app.rankingenem.com/
```

## Nice-to-haves (not yet done)

- **HTTPS on Coolify itself**: add a DNS record `coolify.rankingenem.com → 212.85.19.50`, set it as Coolify's Instance URL in Settings, let Let's Encrypt issue a cert. Then migrate both webhooks to `https://coolify.rankingenem.com/...` and re-enable SSL verification in GitHub.
- **CI gate**: a GitHub Action running `tsc --noEmit`, `pnpm lint`, and `pytest` that blocks the PR merge so a broken commit can't auto-deploy. See the project's README for environment requirements.
- **Branch protection on `main`**: require PR + passing checks before merge (requires the CI gate above).
- **Production Supabase migration**: apply `supabase-migrations.sql` to the production project so dashboard features don't return empty data.

## When invoked by the user

If the user runs `/hostinger`, use the context here to:
1. Resolve any deploy-related question without re-discovering the infra.
2. Before giving instructions, confirm which app is affected (`api`, `web`, or both).
3. Always prefer the webhook-based auto-deploy over manual SSH surgery.
4. Remind about the `NEXT_PUBLIC_*` build-time trap whenever frontend env vars are discussed.
5. Warn about local-vs-production Supabase drift when the user is about to ship features that rely on the RPCs/columns listed above.
