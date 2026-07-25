import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { submitTawarruqFormAction } from '@/features/finance/actions';

export const dynamic = 'force-dynamic';
type Application = { id: string; amount: number | string; currency: string; purpose: string; status: string; partner_status: string | null; created_at: string };

export default async function TawarruqPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/tawarruq');
  const { data } = await supabase.from('tawarruq_applications').select('id, amount, currency, purpose, status, partner_status, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
  const applications = (data ?? []) as unknown as Application[];
  return <div className="space-y-10"><div><p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Partner finance</p><h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">Tawarruq</h1><p className="mt-2 text-muted-foreground">Submit an application for review and partner-bank handoff. Approval is not guaranteed.</p></div>
    <form action={submitTawarruqFormAction} className="max-w-xl space-y-4 border border-border bg-card p-6"><div className="space-y-2"><Label htmlFor="amount">Requested amount (KES)</Label><Input id="amount" name="amount" type="number" min="1000" required /></div><div className="space-y-2"><Label htmlFor="purpose">Purpose</Label><Textarea id="purpose" name="purpose" minLength={5} required /></div><Button type="submit">Submit application</Button></form>
    <section><h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Your applications</h2>{applications.length ? <ul className="mt-4 divide-y divide-border border-y border-border">{applications.map((application) => <li key={application.id} className="flex justify-between gap-4 py-5"><div><p className="font-medium">{application.purpose}</p><p className="mt-1 text-sm text-muted-foreground">{application.status}{application.partner_status ? ` · ${application.partner_status}` : ''}</p></div><strong>{formatCurrency(Number(application.amount), application.currency)}</strong></li>)}</ul> : <p className="mt-3 text-muted-foreground">No applications yet.</p>}</section>
  </div>;
}
