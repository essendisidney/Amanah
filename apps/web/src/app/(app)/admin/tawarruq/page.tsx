import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  submitTawarruqToPartnerAction,
  updateTawarruqPartnerStatusAction,
} from '@/features/finance/actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Tawarruq' };
export const dynamic = 'force-dynamic';

type AppRow = {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  purpose: string;
  status: string;
  partner_status: string | null;
  partner_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function AdminTawarruqPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('tawarruq_applications')
    .select(
      'id, user_id, amount, currency, purpose, status, partner_status, partner_reference, metadata, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as AppRow[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Tawarruq handoff
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit applications to the partner queue. The{' '}
          <code className="text-xs">tawarruq-partner</code> Edge worker calls{' '}
          <code className="text-xs">TAWARRUQ_PARTNER_API_*</code> when set, otherwise simulates
          acknowledgement.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
            return (
              <li key={row.id} className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.purpose}</p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(amount, row.currency)} · {formatDate(row.created_at)} · user{' '}
                      {row.user_id.slice(0, 8)}…
                      {row.partner_reference ? ` · ref ${row.partner_reference}` : ''}
                      {row.partner_status ? ` · partner ${row.partner_status}` : ''}
                    </p>
                    {typeof row.metadata?.last_error === 'string' ? (
                      <p className="mt-1 text-xs text-destructive">
                        Last API error: {row.metadata.last_error}
                        {typeof row.metadata.handoff === 'string'
                          ? ` · handoff ${row.metadata.handoff}`
                          : ''}
                      </p>
                    ) : typeof row.metadata?.handoff === 'string' ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Handoff: {row.metadata.handoff}
                        {row.metadata.simulated === true ? ' (simulated)' : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === 'requested' ? (
                    <form action={submitTawarruqToPartnerAction}>
                      <input type="hidden" name="applicationId" value={row.id} />
                      <Button type="submit" size="sm">
                        Submit to partner
                      </Button>
                    </form>
                  ) : null}
                </div>
                {row.status !== 'closed' ? (
                  <form
                    action={updateTawarruqPartnerStatusAction}
                    className="grid gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <input type="hidden" name="applicationId" value={row.id} />
                    <div className="space-y-1">
                      <Label htmlFor={`status-${row.id}`}>Status</Label>
                      <select
                        id={`status-${row.id}`}
                        name="status"
                        defaultValue={row.status}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="requested">requested</option>
                        <option value="submitted_to_partner">submitted_to_partner</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                        <option value="disbursed">disbursed</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pref-${row.id}`}>Partner ref</Label>
                      <Input
                        id={`pref-${row.id}`}
                        name="partnerReference"
                        defaultValue={row.partner_reference ?? ''}
                        placeholder="PTR-…"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pstat-${row.id}`}>Partner status</Label>
                      <Input
                        id={`pstat-${row.id}`}
                        name="partnerStatus"
                        defaultValue={row.partner_status ?? ''}
                        placeholder="queued / approved…"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" size="sm" variant="outline">
                        Update status
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
