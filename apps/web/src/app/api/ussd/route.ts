import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type UssdSession = { sessionId: string; phone: string; lastInput: string };
const memorySessions = new Map<string, UssdSession>();

function menu(text: string): string {
  const parts = text.split('*').filter(Boolean);
  if (parts.length === 0) return 'CON Welcome to Amanah\n1. Balance\n2. Circles\n3. Pay';
  switch (parts[0]) {
    case '1': return 'END Your wallet balance is available in the Amanah app.';
    case '2': return 'END Your circles are available in the Amanah app.';
    case '3': return parts.length === 1 ? 'CON Pay\n1. Circle contribution\n2. Qard repayment' : 'END Payment requests are completed securely in the Amanah app.';
    default: return 'END Invalid choice. Please dial again.';
  }
}

async function saveSession(session: UssdSession) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    memorySessions.set(session.sessionId, session);
    return;
  }
  const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
  const service = supabase as unknown as {
    from: (table: string) => {
      upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<unknown>;
    };
  };
  await service.from('ussd_sessions').upsert({
    session_id: session.sessionId, phone: session.phone, last_input: session.lastInput,
    menu_state: session.lastInput ? 'navigating' : 'home',
  }, { onConflict: 'session_id' });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const sessionId = String(form.get('sessionId') ?? '');
  const phone = String(form.get('phoneNumber') ?? '');
  const text = String(form.get('text') ?? '');
  if (!sessionId || !phone) return new NextResponse('END Invalid USSD request.', { status: 400 });
  await saveSession({ sessionId, phone, lastInput: text });
  return new NextResponse(menu(text), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
