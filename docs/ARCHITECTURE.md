# Architecture — Phase 1.1

## Goals

Establish a scalable monorepo foundation before auth, schema, and product features land.

## System shape

```
┌─────────────────────────────────────────────────────────┐
│                      apps/web (Next.js)                 │
│  App Router · Server Actions · Middleware · Features    │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
     ┌──────────▼──────────┐ ┌────────▼────────┐
     │   @jamiya/ui        │ │ @jamiya/auth    │
     │   Design system     │ │ RBAC / guards   │
     └──────────┬──────────┘ └────────┬────────┘
                │                     │
     ┌──────────▼─────────────────────▼────────┐
     │  @jamiya/shared · @jamiya/types         │
     └──────────────────┬──────────────────────┘
                        │
              ┌─────────▼─────────┐
              │ @jamiya/database  │
              │ Supabase clients  │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │   Supabase Cloud  │
              │ Postgres · Auth · │
              │ Storage · Edge    │
              └───────────────────┘
```

## Design decisions

1. **pnpm workspaces + Turborepo** — fast installs, filtered builds, cacheable pipelines for Vercel.
2. **Feature-based `apps/web/src/features`** — domain modules own UI, hooks, and server actions; shared chrome stays in `components/`.
3. **Package boundaries** — UI never imports database; auth never imports Next.js APIs; database owns all Supabase client factories.
4. **Strict TypeScript** — `noUncheckedIndexedAccess`, consistent type imports, no `any`.
5. **Design tokens first** — Emerald / White / Dark Gray / Gold in `@jamiya/ui` before feature screens.
6. **Env discipline** — public vs service-role keys separated; `.env.example` is the contract for Vercel.

## What is intentionally deferred

| Concern | Phase |
|---------|-------|
| Auth flows + middleware guards | 1.2 ✓ |
| Full Postgres schema + RLS | 1.3 ✓ |
| Dashboard / circle CRUD | 1.4–1.6 |
| Profile / KYC | 1.7 |
| Admin console | 1.8 |

## Security posture (already encoded)

- Service role key never in `NEXT_PUBLIC_*`
- Roles will live in `app_metadata` / `profiles.platform_role` (never `user_metadata`) — enforced in Phase 1.2–1.3
- Middleware placeholder ready for session refresh
- Input validators start in `@jamiya/shared` (Zod)
