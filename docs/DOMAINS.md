# Domains — jameiyah.com & jameiyah.co.ke

Production app currently: `https://amanah-liart.vercel.app` (Vercel project **amanah**).

## Goal

| Domain | Role |
|--------|------|
| `jameiyah.com` | Primary global site |
| `www.jameiyah.com` | Redirect → apex |
| `jameiyah.co.ke` | Kenya site (same app) |
| `www.jameiyah.co.ke` | Redirect → apex `.co.ke` |

Both domains serve the same Next.js app (marketing `/` + product).

## 1. Add domains in Vercel

From the monorepo root (project already linked):

```bash
npx vercel domains add jameiyah.com
npx vercel domains add www.jameiyah.com
npx vercel domains add jameiyah.co.ke
npx vercel domains add www.jameiyah.co.ke
```

Or: Vercel Dashboard → Project **amanah** → Settings → Domains → Add.

Assign each domain to **Production**.

## 2. DNS at your registrar

### If using Vercel nameservers
Point the domain’s NS records to the nameservers Vercel shows after you add the domain.

### Current registrar DNS (host-ww.net)

Both domains currently use nameservers:
- `ns1.host-ww.net` … `ns4.host-ww.net`

Keep those NS records. At the DNS panel for each domain, add:

| Host | Type | Value |
|------|------|-------|
| `@` (apex) | A | `76.76.21.21` |
| `www` | A | `76.76.21.21` |

(Or CNAME `www` → `cname.vercel-dns.com` if your panel prefers CNAME for www.)

SSL certificates issue automatically after DNS points at Vercel.

## 3. App env after domains go live

In Vercel → Environment Variables (Production):

```
NEXT_PUBLIC_APP_URL=https://jameiyah.com
```

Also update Supabase Auth → URL configuration:

- Site URL: `https://jameiyah.com`
- Redirect URLs:  
  `https://jameiyah.com/auth/callback`  
  `https://jameiyah.co.ke/auth/callback`  
  `https://www.jameiyah.com/auth/callback`  
  `https://www.jameiyah.co.ke/auth/callback`

Redeploy after env changes.

## 4. Optional: redirect `.co.ke` ↔ `.com`

In Vercel domain settings you can set one apex as primary and redirect the other, or keep both as aliases of the same deployment.
