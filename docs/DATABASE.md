# Database — Phase 1.3

## Overview

Normalized PostgreSQL schema for the Amanah ROSCA platform, layered on the Phase 1.2 auth bootstrap (`profiles`).

## Entity relationship (simplified)

```
auth.users 1──1 profiles 1──* wallets 1──* transactions
                │
                ├──* jamiyas (created_by)
                ├──* members *──1 jamiyas
                ├──* invitations
                ├──* notifications
                ├──* kyc_documents
                └──* audit_logs

jamiyas 1──* contributions
jamiyas 1──* payouts
members 1──* contributions
members 1──* payouts
```

## Tables

| Table | Purpose |
|-------|---------|
| `profiles` | App user profile + platform RBAC (Phase 1.2) |
| `jamiyas` | Rotating savings circles |
| `members` | Circle membership + payout order |
| `invitations` | Invite tokens (hashed) |
| `contributions` | Per-member per-cycle dues |
| `payouts` | Per-cycle recipient payouts |
| `wallets` | Per-user per-currency balances (client read-only) |
| `transactions` | Ledger entries |
| `notifications` | In-app (and future channel) alerts |
| `kyc_documents` | KYC file metadata |
| `audit_logs` | Append-oriented compliance trail |

## Key triggers

| Trigger | Behavior |
|---------|----------|
| `on_auth_user_created` | Creates `profiles` + `app_metadata.platform_role` |
| `on_profile_created_wallet` | Creates default `KES` wallet |
| `on_jamiya_created_add_admin` | Adds creator as `circle_admin` member |
| `members_sync_count_*` | Maintains `jamiyas.member_count` for active members |

## RLS model

- Helpers live in **`private`** schema (`SECURITY DEFINER`, `search_path = ''`)
- Circle access via `private.is_jamiya_member` / `is_circle_admin`
- Platform admin via `private.is_platform_admin`
- Compliance via `private.is_compliance_or_admin`
- **Wallets are not client-writable** (prevents balance tampering)
- **Audit logs are not client-updatable/deletable**

## Storage

Bucket `kyc-documents` (private):

- Path convention: `{user_id}/{document_id}/{filename}`
- Max 10MB; JPEG/PNG/WebP/PDF

## Migrations

1. `20260722181533_profiles_auth_bootstrap.sql`
2. `20260722185603_domain_schema.sql`

Apply locally:

```bash
pnpm db:start
pnpm db:reset   # runs migrations + seed
pnpm gen:types  # optional regenerate TS types
```

## Seed accounts (local only)

| Email | Password | Role |
|-------|----------|------|
| `admin@jamiya.local` | `Password1!` | super_admin |
| `compliance@jamiya.local` | `Password1!` | compliance_officer |
| `alice@jamiya.local` | `Password1!` | member (circle admin of demo jamiya) |
| `bob@jamiya.local` | `Password1!` | member |

Demo jamiya: **Nairobi Sisters Circle** (`nairobi-sisters-circle`).
