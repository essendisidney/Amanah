# Amanah Mobile (Expo)

Phase 6 client with Home, Circles, Dues (pay), Invites, and KYC status — backed by `/api/v1`.

## Setup

```bash
cd apps/mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL
pnpm install
pnpm start
```

For production API base use your Vercel URL, e.g. `https://amanah-liart.vercel.app`.
