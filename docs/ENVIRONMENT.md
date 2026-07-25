# Environment variables

Source of truth for local + Vercel: `apps/web/.env.example`.

| Variable | Scope | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Canonical site URL |
| `NEXT_PUBLIC_APP_NAME` | Public | No | Defaults to Amanah |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes* | Admin ops only; never ship to browser |
| `SUPABASE_JWT_SECRET` | Server | Optional | For custom JWT verification |

\* Required for admin/server jobs once Phase 1.8 lands; not needed for read-only landing page.
