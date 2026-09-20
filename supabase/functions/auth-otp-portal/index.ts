import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Temporary phone-OTP portal hosted on Edge while Vercel Production
 * is missing SUPABASE_SERVICE_ROLE_KEY / stuck on an old deploy.
 * Uses auth-otp-send + auth-otp-verify, then redirects into jameiyah.com
 * with a Supabase session hash the browser client can pick up.
 */

const APP = "https://jameiyah.com";
const FN = "https://vzpnixfqkvovbniaoudx.supabase.co/functions/v1";

function html(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}

Deno.serve((_req: Request) => {
  return html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jameiyah — Phone sign-in</title>
  <style>
    :root { color-scheme: light; --ink:#14211a; --muted:#5a6b62; --line:#d7e0da; --bg:#f4f7f5; --accent:#1f6b4a; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Georgia, "Times New Roman", serif; background:
      radial-gradient(1200px 600px at 10% -10%, #d9efe4 0%, transparent 55%),
      radial-gradient(900px 500px at 100% 0%, #e8f0ea 0%, transparent 50%),
      var(--bg); color: var(--ink); min-height:100vh; display:grid; place-items:center; padding:24px; }
    main { width:min(420px,100%); }
    h1 { font-size:1.75rem; margin:0 0 .35rem; letter-spacing:-0.02em; }
    p { margin:0 0 1.25rem; color:var(--muted); font-family: system-ui, sans-serif; font-size:.95rem; line-height:1.45; }
    label { display:block; font-family: system-ui, sans-serif; font-size:.8rem; margin-bottom:.35rem; color:var(--muted); }
    input { width:100%; padding:.85rem 1rem; border:1px solid var(--line); border-radius:10px; font-size:1.05rem; background:#fff; margin-bottom:1rem; }
    button { width:100%; padding:.95rem 1rem; border:0; border-radius:10px; background:var(--accent); color:#fff; font-size:1rem; font-family: system-ui, sans-serif; font-weight:600; cursor:pointer; }
    button:disabled { opacity:.6; cursor:wait; }
    .msg { font-family: system-ui, sans-serif; font-size:.9rem; margin:0 0 1rem; min-height:1.2em; }
    .err { color:#9b1c1c; }
    .ok { color:var(--accent); }
    .hint { margin-top:1.25rem; font-size:.8rem; color:var(--muted); font-family: system-ui, sans-serif; }
    a { color:var(--accent); }
  </style>
</head>
<body>
  <main>
    <h1>Jameiyah</h1>
    <p>Sign in with your Kenya mobile. Codes are sent by SMS.</p>
    <div id="msg" class="msg" role="status"></div>
    <form id="form">
      <div id="step-phone">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="07XX XXX XXX" required />
        <button type="submit" id="send">Send code</button>
      </div>
      <div id="step-otp" hidden>
        <label for="otp">6-digit code</label>
        <input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" />
        <button type="submit" id="verify">Verify &amp; continue</button>
      </div>
    </form>
    <p class="hint">Having trouble on the main site? This backup sign-in uses the same SMS service. <a href="${APP}/phone">Back to app</a></p>
  </main>
  <script>
    const ANON = ${JSON.stringify(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cG5peGZxa3ZvdmJuaWFvdWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4ODk5NzAsImV4cCI6MjEwMDQ2NTk3MH0.GB4rwklIORd94sI8pNGET8HuUTycqhfUtcdLhUFxtyw"
  )};
    const FN = ${JSON.stringify(FN)};
    const APP = ${JSON.stringify(APP)};
    const msg = document.getElementById('msg');
    const form = document.getElementById('form');
    const stepPhone = document.getElementById('step-phone');
    const stepOtp = document.getElementById('step-otp');
    let phone = '';

    function setMsg(text, ok) {
      msg.textContent = text || '';
      msg.className = 'msg ' + (ok ? 'ok' : text ? 'err' : '');
    }

    async function call(path, body) {
      const res = await fetch(FN + '/' + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON,
          Authorization: 'Bearer ' + ANON,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Request failed');
      }
      return json;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sendBtn = document.getElementById('send');
      const verifyBtn = document.getElementById('verify');
      try {
        if (!stepOtp.hidden) {
          verifyBtn.disabled = true;
          setMsg('Verifying…', true);
          const otp = document.getElementById('otp').value.trim();
          const json = await call('auth-otp-verify', { phone, otp });
          if (!json.access_token || !json.refresh_token) throw new Error('No session returned');
          const hash = new URLSearchParams({
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expires_in: String(json.expires_in || 3600),
            token_type: 'bearer',
            type: 'recovery',
          });
          const next = json.profile_completed ? '/dashboard' : '/onboarding';
          location.href = APP + next + '#' + hash.toString();
          return;
        }
        sendBtn.disabled = true;
        setMsg('Sending code…', true);
        phone = document.getElementById('phone').value.trim();
        await call('auth-otp-send', { phone });
        stepPhone.hidden = true;
        stepOtp.hidden = false;
        setMsg('Code sent. Check your SMS.', true);
        document.getElementById('otp').focus();
      } catch (err) {
        setMsg(err.message || 'Something went wrong', false);
      } finally {
        sendBtn.disabled = false;
        verifyBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`);
});
