# Amanah Mobile (Expo)

Phase 13 client: Home, Circles, Dues, **Wallet**, **Finance**, **Officer**, Invites, KYC — backed by `/api/v1`.

## Setup

```bash
cd apps/mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL
pnpm install
pnpm start
```

For production API base use your Vercel URL, e.g. `https://amanah-liart.vercel.app`.

### API surface used

| Tab | Routes |
|-----|--------|
| Wallet | `GET /api/v1/wallet`, `POST /api/v1/wallet/top-up`, `POST /api/v1/wallet/retry` |
| Finance | `GET\|POST /api/v1/finance/qard` (+ tawarruq/goals/welfare available) |
| Officer | `GET\|POST /api/v1/jamiyas/[id]/officer` |

Top-up follows web `PAYMENT_PROVIDER` (`simulated` or `bank`). Live Daraja remains deferred.
