# Environment variables

Source of truth for local + Vercel: `apps/web/.env.example`.

| Variable | Scope | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Canonical site URL |
| `NEXT_PUBLIC_APP_NAME` | Public | No | Defaults to Jameiyah |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes* | Admin ops only; never ship to browser |
| `SUPABASE_JWT_SECRET` | Server | Optional | For custom JWT verification |
| `TAIFA_API_KEY` | Server | Yes | Taifa Mobile SMS key (Taifa portal → API & developers). Set on Vercel **and** as a Supabase Edge secret (`auth-otp-send`, `notify-dispatch`). Sent as the `h_api_key` header to `https://api.taifamobile.co.ke/v2/sms/sendsms`. Never commit the value. |
| `TAIFA_SENDER_ID` | Server | Yes | Sender name registered on the Taifa account (Taifa portal → Sender names), e.g. `SIDNET`. Same two places as the key. |

\* Required for admin/server jobs once Phase 1.8 lands; not needed for read-only landing page.
