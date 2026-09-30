# Builds and serves a production build on http://127.0.0.1:3000 against the LOCAL Supabase stack only.
# Values from apps/web/.env.journey.local override .env.local (which points at production).
$root = 'D:\Amanah'
Get-Content "$root\apps\web\.env.journey.local" | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  Set-Item -Path "Env:$($k.Trim())" -Value $v.Trim()
}
if ($env:NEXT_PUBLIC_SUPABASE_URL -notmatch '127\.0\.0\.1|localhost') { throw 'Refusing to start: not pointed at local Supabase' }
Set-Location "$root\apps\web"
if ($args -notcontains '--no-build') {
  pnpm exec next build --no-lint
  if ($LASTEXITCODE -ne 0) { throw 'build failed' }
}
pnpm exec next start -H 127.0.0.1 -p 3000
