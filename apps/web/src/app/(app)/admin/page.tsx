import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();

  const [users, jamiyas, pendingKyc, transactions, audits] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('jamiyas').select('id', { count: 'exact', head: true }),
    supabase
      .from('kyc_documents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['uploaded', 'under_review']),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
  ]);

  const cards = [
    { label: 'Users', value: users.count ?? 0 },
    { label: 'Circles', value: jamiyas.count ?? 0 },
    { label: 'Pending KYC', value: pendingKyc.count ?? 0 },
    { label: 'Transactions', value: transactions.count ?? 0 },
    { label: 'Audit events', value: audits.count ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Compliance and platform operations overview. Use the tabs above to manage records.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
