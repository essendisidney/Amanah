# Phase 1 complete — Join, Profile, Admin

## 1.6 Join / invitations

- Circle admins create email/phone invites (`token_hash` stored, raw token in link)
- `/invitations/[token]` accept/decline via SECURITY DEFINER RPCs
- Members list + pending invites on jamiya details
- Notifications + audit on invite/accept

Migration: `20260722193602_invitation_accept_rpc.sql`

## 1.7 Profile

- Edit name/phone/bio/country (`profile_completed = true`)
- KYC upload to `kyc-documents` storage
- Trigger sets `kyc_status = pending` on upload

## 1.8 Admin

- Role-gated `/admin/*` (compliance+)
- Overview, users (role change), jamiyas, transactions, KYC review RPC, audit logs
- Admin nav link appears for compliance/platform/super admins

## Apply locally

```bash
pnpm db:reset
# or push migrations to linked project
```
