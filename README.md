# Amanah

Shariah-compliant digital rotating savings platform (ROSCA).

## Monorepo

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js 15 App Router web application |
| `packages/ui` | Shared design system (shadcn-style, design tokens) |
| `packages/database` | Supabase clients + typed Database contracts |
| `packages/auth` | RBAC helpers and auth guards |
| `packages/types` | Shared domain TypeScript types |
| `packages/shared` | Constants, utilities, Zod validators |
| `packages/typescript-config` | Shared TSConfigs |
| `packages/eslint-config` | Shared ESLint flat configs |
| `supabase/` | Migrations, Edge Functions, seed, CLI config |
| `docs/` | Architecture and runbooks |

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for local Supabase)
- Supabase CLI (`npx supabase` or global install)

## Quick start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill Supabase URL + anon key (local or remote)

pnpm --filter @jamiya/web dev
```

App: [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all package `dev` tasks via Turborepo |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | TypeScript `--noEmit` across packages |
| `pnpm format` | Prettier write |
| `pnpm db:start` | Start local Supabase stack |
| `pnpm gen:types` | Generate DB types into `@jamiya/database` |

## Deployment (Vercel)

1. Connect the GitHub repository to Vercel.
2. Set Root Directory to `.` (monorepo root).
3. Build uses `vercel.json` → `pnpm turbo run build --filter=@jamiya/web`.
4. Configure environment variables from `apps/web/.env.example`.

## Phase roadmap

See [docs/PHASES.md](./docs/PHASES.md).
