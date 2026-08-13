# Amanah Mobile (Expo)

Phase 13 client: Home, Circles, Dues, **Wallet**, **Finance**, **Officer**, Invites, KYC — backed by `/api/v1`.

## Android install — what to use

| Audience | Path | Notes |
|----------|------|--------|
| Members / field testers | **Web PWA** at https://amanah-liart.vercel.app | Open in **Chrome** → menu (⋮) → **Install app** / **Add to Home screen**. |
| Engineers | This Expo app via **Expo Go** (SDK 53) | Sandbox limits apply. |
| Store APK / AAB | Scaffolded | `eas.json` (`preview` APK, `production` AAB). Needs Expo/EAS login + Play Console. |

## Setup

```bash
cd apps/mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL
pnpm install
pnpm start
```

For a **physical Android device**, do not leave the API on `127.0.0.1`. Use production `https://amanah-liart.vercel.app` or `npx expo start --tunnel`.

### API surface used

| Tab | Routes |
|-----|--------|
| Circles | `GET\|POST /api/v1/circles`, `POST /api/v1/invitations` |
| Wallet | `GET /api/v1/wallet`, `POST /api/v1/wallet/top-up`, `POST /api/v1/wallet/retry` |
| Finance | `GET\|POST /api/v1/finance/qard` (+ tawarruq/goals/welfare available) |
| Officer | `GET\|POST /api/v1/circles/[id]/officer` |

Top-up follows web `PAYMENT_PROVIDER` (`simulated` or `bank`). Live Daraja remains deferred.

## EAS / Play Store (scaffold)

```bash
cd apps/mobile
npx eas-cli login
npx eas build -p android --profile preview   # internal APK
npx eas build -p android --profile production # Play AAB
```

Requires an Expo project id in `app.json` (`extra.eas.projectId`) and Google Play credentials for submit.
