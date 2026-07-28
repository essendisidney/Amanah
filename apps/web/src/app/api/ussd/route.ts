import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type UssdSession = { sessionId: string; phone: string; lastInput: string };
const memorySessions = new Map<string, UssdSession>();

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (raw.startsWith('+')) return raw;
  return raw;
}

function phoneVariants(phone: string): string[] {
  const e164 = normalizePhone(phone);
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('254') ? `0${digits.slice(3)}` : digits;
  return Array.from(new Set([e164, `+${digits}`, digits, local, phone]));
}

async function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

async function resolveUser(phone: string) {
  const supabase = await serviceClient();
  if (!supabase) return null;
  const variants = phoneVariants(phone);
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, mpesa_phone')
    .or(
      variants
        .flatMap((v) => [`phone.eq.${v}`, `mpesa_phone.eq.${v}`])
        .join(','),
    )
    .maybeSingle();
  return profile as { id: string; full_name: string | null } | null;
}

async function walletBalance(userId: string): Promise<string> {
  const supabase = await serviceClient();
  if (!supabase) return 'Unavailable offline.';
  const { data } = await supabase
    .from('wallets')
    .select('currency, available_balance')
    .eq('user_id', userId)
    .order('currency');
  const rows = (data ?? []) as Array<{ currency: string; available_balance: number | string }>;
  if (!rows.length) return 'KES 0.00 (no wallet yet)';
  return rows
    .map((row) => `${row.currency} ${Number(row.available_balance).toFixed(2)}`)
    .join(', ');
}

async function circleSummary(userId: string): Promise<string> {
  const supabase = await serviceClient();
  if (!supabase) return 'Unavailable offline.';
  const { data: members } = await supabase
    .from('members')
    .select('role, status, jamiya_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(5);
  const memberRows = (members ?? []) as Array<{
    role: string;
    status: string;
    jamiya_id: string;
  }>;
  if (!memberRows.length) return 'You are not in an active circle.';
  const ids = memberRows.map((m) => m.jamiya_id);
  const { data: jamiyas } = await supabase
    .from('jamiyas')
    .select('id, name, slug')
    .in('id', ids);
  const byId = new Map(
    ((jamiyas ?? []) as Array<{ id: string; name: string }>).map((j) => [j.id, j.name]),
  );
  return memberRows
    .map((m, i) => `${i + 1}. ${byId.get(m.jamiya_id) ?? 'Circle'} (${m.role})`)
    .join('\n');
}

async function dueSummary(userId: string): Promise<string> {
  const supabase = await serviceClient();
  if (!supabase) return 'Open the Amanah app to pay.';
  const { data: members } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');
  const memberIds = ((members ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (!memberIds.length) return 'No dues — join a circle first.';
  const { data: dues } = await supabase
    .from('contributions')
    .select('amount, currency, due_date, status')
    .in('member_id', memberIds)
    .in('status', ['pending', 'late', 'partial'])
    .order('due_date', { ascending: true })
    .limit(3);
  const rows = (dues ?? []) as Array<{
    amount: number | string;
    currency: string;
    due_date: string;
    status: string;
  }>;
  if (!rows.length) return 'No pending contributions. Pay in the app when due.';
  return rows
    .map(
      (row) =>
        `${row.currency} ${Number(row.amount).toFixed(0)} due ${row.due_date.slice(0, 10)} (${row.status})`,
    )
    .join('\n');
}

async function menu(text: string, phone: string): Promise<string> {
  const parts = text.split('*').filter(Boolean);
  const profile = await resolveUser(phone);
  const greet = profile?.full_name
    ? `CON Habari ${profile.full_name.split(' ')[0]}\n`
    : 'CON Welcome to Amanah\n';

  if (parts.length === 0) {
    return `${greet}1. Balance\n2. Circles\n3. Dues\n4. Help`;
  }

  switch (parts[0]) {
    case '1': {
      if (!profile) return 'END Link this phone in the Amanah app (Profile → M-Pesa).';
      const bal = await walletBalance(profile.id);
      return `END Wallet: ${bal}`;
    }
    case '2': {
      if (!profile) return 'END Link this phone in the Amanah app first.';
      const circles = await circleSummary(profile.id);
      return `END Your circles:\n${circles}`;
    }
    case '3': {
      if (parts.length === 1) {
        return 'CON Dues\n1. View pending\n2. Pay in app';
      }
      if (parts[1] === '1') {
        if (!profile) return 'END Link this phone in the Amanah app first.';
        const dues = await dueSummary(profile.id);
        return `END ${dues}`;
      }
      return 'END Open the Amanah app → Circles to pay securely.';
    }
    case '4':
      return 'END Support: use in-app chat or visit amanah.app. Dial again for menu.';
    default:
      return 'END Invalid choice. Please dial again.';
  }
}

async function saveSession(session: UssdSession) {
  const supabase = await serviceClient();
  if (!supabase) {
    memorySessions.set(session.sessionId, session);
    return;
  }
  await supabase.from('ussd_sessions').upsert(
    {
      session_id: session.sessionId,
      phone: session.phone,
      last_input: session.lastInput,
      menu_state: session.lastInput ? 'navigating' : 'home',
    },
    { onConflict: 'session_id' },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const sessionId = String(form.get('sessionId') ?? '');
  const phone = String(form.get('phoneNumber') ?? '');
  const text = String(form.get('text') ?? '');
  if (!sessionId || !phone) {
    return new NextResponse('END Invalid USSD request.', { status: 400 });
  }
  await saveSession({ sessionId, phone, lastInput: text });
  const body = await menu(text, phone);
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
