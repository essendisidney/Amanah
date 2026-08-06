import type { Metadata } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { setCampaignFeePolicyFormAction } from '@/features/charity/admin-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · Sadaka' };
export const dynamic = 'force-dynamic';

type Campaign = {
  id: string;
  slug: string;
  title: string;
  status: string;
  fee_mode: string;
  fee_bps: number;
  sharia_board_endorsed: boolean;
  goal_amount: number | string;
  raised_amount: number | string;
  currency: string;
  updated_at: string;
};

type PolicyEvent = {
  id: string;
  campaign_id: string;
  fee_mode: string;
  fee_bps: number;
  sharia_board_endorsed: boolean;
  decision_reference: string | null;
  notes: string | null;
  created_at: string;
};

export default async function AdminSadakaPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();

  const [{ data: campaigns }, { data: events }] = await Promise.all([
    supabase
      .from('charity_campaigns')
      .select(
        'id, slug, title, status, fee_mode, fee_bps, sharia_board_endorsed, goal_amount, raised_amount, currency, updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('sharia_fee_policy_events')
      .select(
        'id, campaign_id, fee_mode, fee_bps, sharia_board_endorsed, decision_reference, notes, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const rows = (campaigns ?? []) as unknown as Campaign[];
  const history = (events ?? []) as unknown as PolicyEvent[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Sadaka fee policy
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set donation fee mode and record Sharia board endorsement. Both{' '}
          <code className="text-xs">donation_addon</code> and{' '}
          <code className="text-xs">donation_deduct</code> are supported in ledger math; flip
          endorsement after board sign-off without a redeploy.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => {
            const raised =
              typeof row.raised_amount === 'number'
                ? row.raised_amount
                : Number(row.raised_amount);
            const goal =
              typeof row.goal_amount === 'number' ? row.goal_amount : Number(row.goal_amount);
            return (
              <li key={row.id} className="space-y-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.title}</p>
                      <StatusBadge status={row.status} />
                      {row.sharia_board_endorsed ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Endorsed
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Pending board
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      /{row.slug} · raised {formatCurrency(raised, row.currency)} of{' '}
                      {formatCurrency(goal, row.currency)} · fee {(row.fee_bps / 100).toFixed(2)}%{' '}
                      ({row.fee_mode}) · updated {formatDate(row.updated_at)}
                    </p>
                  </div>
                </div>
                <form
                  action={setCampaignFeePolicyFormAction}
                  className="grid gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <input type="hidden" name="campaignId" value={row.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`mode-${row.id}`}>Fee mode</Label>
                    <select
                      id={`mode-${row.id}`}
                      name="feeMode"
                      defaultValue={row.fee_mode}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="donation_addon">donation_addon (donor pays fee on top)</option>
                      <option value="donation_deduct">donation_deduct (fee from gift)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`bps-${row.id}`}>Fee (bps)</Label>
                    <Input
                      id={`bps-${row.id}`}
                      name="feeBps"
                      type="number"
                      min={0}
                      max={2000}
                      defaultValue={row.fee_bps}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`status-${row.id}`}>Status</Label>
                    <select
                      id={`status-${row.id}`}
                      name="status"
                      defaultValue={row.status}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="draft">draft</option>
                      <option value="live">live</option>
                      <option value="paused">paused</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`endorsed-${row.id}`}>Sharia board</Label>
                    <select
                      id={`endorsed-${row.id}`}
                      name="shariaBoardEndorsed"
                      defaultValue={row.sharia_board_endorsed ? 'true' : 'false'}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="false">Pending sign-off</option>
                      <option value="true">Endorsed</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`ref-${row.id}`}>Decision reference</Label>
                    <Input
                      id={`ref-${row.id}`}
                      name="decisionReference"
                      placeholder="Board minute / letter ID"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`notes-${row.id}`}>Notes</Label>
                    <Input id={`notes-${row.id}`} name="notes" placeholder="Optional notes" />
                  </div>
                  <div className="flex items-end sm:col-span-2 lg:col-span-3">
                    <Button type="submit" size="sm">
                      Save fee policy
                    </Button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-3">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Recent policy decisions
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No policy events yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {history.map((ev) => (
              <li key={ev.id} className="px-5 py-3">
                <p className="font-medium">
                  {ev.fee_mode} · {ev.fee_bps} bps ·{' '}
                  {ev.sharia_board_endorsed ? 'endorsed' : 'pending'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatDate(ev.created_at)}
                  {ev.decision_reference ? ` · ref ${ev.decision_reference}` : ''}
                  {ev.notes ? ` · ${ev.notes}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
