# Dashboard — Phase 1.4

## Goals

Give authenticated members a production-ready home that surfaces real domain data with loading and empty states.

## Architecture

```
(app)/layout.tsx          App shell (nav + unread badge + sign out)
(app)/dashboard/page.tsx  Server Component → getDashboardData()
features/dashboard/
  lib/get-dashboard-data.ts   Parallel Supabase queries (RLS-scoped)
  components/*                Presentational sections
  actions/notification-actions.ts
```

Server Components fetch under RLS. No client-side data waterfall for the initial paint. `loading.tsx` shows skeletons via React Suspense boundaries.

## Screens

| Route | Purpose |
|-------|---------|
| `/dashboard` | Stats, my jamiyas, contributions, payouts, notifications |
| `/jamiyas` | Full membership list |
| `/jamiyas/[slug]` | Read-only circle summary |
| `/jamiyas/new` | Placeholder → Phase 1.5 |
| `/notifications` | Inbox + mark read actions |
| `/wallet` | Balance display (read-only) |
| `/profile` | Read-only profile summary → Phase 1.7 edit |

## Data loaded

- Profile
- Memberships ↔ jamiyas
- Pending/late contributions for those memberships
- Scheduled/processing payouts
- Recent notifications + unread count
- Default KES wallet

## Database changes

None in Phase 1.4 (consumes Phase 1.3 schema).

## Empty / loading

- Section-level empty states with CTAs where useful
- Dashboard route skeleton while streaming
