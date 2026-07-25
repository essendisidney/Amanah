# Folder structure

```
jamiya/
├── apps/
│   └── web/                      # Next.js 15 application
│       ├── src/
│       │   ├── app/              # App Router routes
│       │   ├── components/       # App-wide UI (providers, layout chrome)
│       │   ├── features/         # Feature modules (added per phase)
│       │   ├── lib/              # App adapters (supabase re-exports, utils)
│       │   └── middleware.ts
│       ├── .env.example
│       └── package.json
├── packages/
│   ├── auth/                     # RBAC helpers & guards
│   ├── database/                 # Supabase clients & Database types
│   ├── eslint-config/
│   ├── shared/                   # Constants, utils, Zod schemas
│   ├── types/                    # Domain TypeScript contracts
│   ├── typescript-config/
│   └── ui/                       # Design system + tokens
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── functions/
│   └── seed/
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
├── vercel.json
└── package.json
```
