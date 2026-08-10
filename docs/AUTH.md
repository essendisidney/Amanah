# Phase 1.2 — Authentication

## Goals

Ship production-ready authentication before the full domain schema.

## Flows delivered

| Flow | Route | Mechanism |
|------|-------|-----------|
| Register | `/register` | Email + password (`signUp`) |
| Login | `/login` | Email + password (`signInWithPassword`) |
| Forgot password | `/forgot-password` | `resetPasswordForEmail` |
| Reset password | `/reset-password` | `updateUser({ password })` after recovery session |
| Phone OTP | `/phone` | `signInWithOtp` + `verifyOtp` |
| Google OAuth | Login / Register | `signInWithOAuth({ provider: 'google' })` |
| OAuth / email callback | `/auth/callback` | `exchangeCodeForSession` |
| Sign out | Dashboard | `signOut` server action |

## Architecture

```
Browser form
   → Server Action (@/features/auth/actions)
   → createClient() [@jamiya/database/server]
   → Supabase Auth API
   → Cookie session (middleware refreshes via getUser)
```

### Middleware

`apps/web/src/middleware.ts` calls `updateSession` on every matched request:

1. Refresh / rotate auth cookies
2. Redirect unauthenticated users away from protected prefixes
3. Redirect authenticated users away from auth pages (except reset-password)

Protected prefixes: `/dashboard`, `/profile`, `/settings`, `/circles`, `/wallet`, `/admin`

### Profile auto-provisioning

Migration `20260722181533_profiles_auth_bootstrap.sql`:

- `public.profiles` (1:1 with `auth.users`)
- `private.handle_new_user` SECURITY DEFINER trigger on `auth.users` INSERT
- Seeds `platform_role = member` in profiles **and** `raw_app_meta_data` (never `user_metadata`)
- RLS: users read/update own row; cannot escalate `platform_role` or `kyc_status`
- Admins can update any profile via `private.is_platform_admin()`

### Folder structure (auth)

```
apps/web/src/features/auth/
  actions/     server actions (email, OTP, OAuth, sign-out)
  components/  forms + AuthCard
  lib/         action state helpers + safe redirects
  index.ts

apps/web/src/app/(auth)/   login, register, phone, forgot/reset password
apps/web/src/app/auth/callback/route.ts
apps/web/src/app/(app)/dashboard/page.tsx
```

## Database changes (Phase 1.2 scope)

| Object | Purpose |
|--------|---------|
| `platform_role` enum | RBAC |
| `kyc_status` enum | KYC lifecycle |
| `profiles` table | App profile per user |
| `private.handle_new_user` | Auto profile + app_metadata role |
| `private.set_updated_at` | Timestamp maintenance |
| `private.current_platform_role` / `is_platform_admin` | RLS helpers |
| RLS policies | Own-row + admin access |

Full ROSCA schema remains Phase 1.3.

## Provider setup checklist

1. Apply migration: `pnpm db:start` then `pnpm db:reset` (local) or push to linked project
2. Copy `apps/web/.env.example` → `.env.local` with project URL + anon key
3. Supabase Auth → URL config: Site URL `http://localhost:3000`, redirect `http://localhost:3000/auth/callback`
4. Enable **Google** provider with Client ID/Secret
5. Enable **Phone** provider (Twilio etc.) for OTP

## Security notes

- Open-redirect prevention via `getSafeRedirectPath`
- Forgot-password always returns a generic success message (no email enumeration)
- Login failures use a generic invalid-credentials message
- Role authorization data is never trusted from `user_metadata`
