# Create circle — Phase 1.5

## Goals

Allow authenticated members to create a rotating savings circle with validated rules, unique slug, audit trail, and automatic circle-admin membership.

## Architecture

```
/circles/new (Server Component page)
   └── CreateCircleForm (RHF + Zod client validation)
         └── createCircleAction (Server Action)
               ├── allocateUniqueSlug()
               ├── INSERT jamiyas (RLS: created_by = auth.uid())
               ├── trigger → members(circle_admin)
               ├── INSERT audit_logs
               └── redirect /circles/[slug]
```

## Validation

Shared schema: `createCircleSchema` in `@jamiya/shared`

- Name, description, amount, currency, max members, cycles, frequency, start date, status (`draft` | `open`)
- Cycle count must be ≥ max members (classic ROSCA alignment)
- Input sanitization via `sanitizePlainText`

## Slug allocation

`slugify(name)` then collide-check `jamiyas.slug`; suffixes `-2`, `-3`, … until unique.

## Database changes

None — uses Phase 1.3 tables/triggers:

- `jamiyas` insert
- `on_jamiya_created_add_admin` → creator as `circle_admin`
- `audit_logs` row (`action = create`)

## Security

- Auth required (server action + middleware)
- RLS `jamiyas_insert_authenticated` requires `created_by = auth.uid()`
- Audit actor bound to session user
