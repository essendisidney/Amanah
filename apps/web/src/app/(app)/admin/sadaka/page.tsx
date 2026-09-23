import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import {
  disburseCampaignFormAction,
  reviewCampaignFormAction,
  setCampaignFeePolicyFormAction,
  verifyInstitutionFormAction,
} from '@/features/charity/admin-actions';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
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
  disbursed_amount: number | string | null;
  beneficiary_phone: string | null;
  beneficiary_name: string | null;
  beneficiary_kyc_doc_url: string | null;
  category: string | null;
  currency: string;
  updated_at: string;
  custody_mode: string | null;
  auto_disburse: boolean | null;
};

type PendingDisbursement = {
  id: string;
  campaign_id: string;
  net_amount: number | string;
  currency: string;
  status: string;
  beneficiary_phone: string;
  notes: string | null;
  created_at: string;
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

type Institution = {
  id: string;
  name: string;
  type: string;
  verification_status: string;
  contact_person: string;
  registration_doc_url: string | null;
  created_at: string;
};

export default async function AdminSadakaPage() {
  await requireAdminAccess('compliance', '/admin/sadaka');
  const { getDictionary } = await import('@/i18n/get-dictionary');
  const { dict } = await getDictionary();
  const supabase = await createClient();

  const [{ data: campaigns }, { data: events }, { data: institutions }, { data: pendingDisbursements }] =
    await Promise.all([
    supabase
      .from('charity_campaigns')
      .select(
        `id, slug, title, status, fee_mode, fee_bps, sharia_board_endorsed, goal_amount, raised_amount,
         disbursed_amount, beneficiary_phone, beneficiary_name, beneficiary_kyc_doc_url, category,
         currency, updated_at, custody_mode, auto_disburse`,
      )
      .order('updated_at', { ascending: false })
      .limit(80),
    supabase
      .from('sharia_fee_policy_events')
      .select(
        'id, campaign_id, fee_mode, fee_bps, sharia_board_endorsed, decision_reference, notes, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('sadaka_institutions')
      .select('id, name, type, verification_status, contact_person, registration_doc_url, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('charity_disbursements')
      .select('id, campaign_id, net_amount, currency, status, beneficiary_phone, notes, created_at')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(40),
  ]);

  const rows = (campaigns ?? []) as unknown as Campaign[];
  const history = (events ?? []) as unknown as PolicyEvent[];
  const orgs = (institutions ?? []) as unknown as Institution[];
  const queued = (pendingDisbursements ?? []) as unknown as PendingDisbursement[];
  const pending = rows.filter((r) => r.status === 'pending_review' || r.status === 'draft');
  const payable = rows.filter(
    (r) =>
      ['live', 'funded', 'disbursed'].includes(r.status) &&
      Number(r.raised_amount) - Number(r.disbursed_amount ?? 0) > 0,
  );

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Sadaka"
        subtitle="Approve campaigns, verify institutions, then disburse."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin' as Route}>Inbox</Link>
          </Button>
        }
      />

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Pending review</h3>
        {pending.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No campaigns awaiting review.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {pending.map((row) => (
              <li key={row.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{row.title}</p>
                    <StatusBadge status={row.status} />
                    {row.category ? <StatusBadge status={row.category} /> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Target {formatCurrency(Number(row.goal_amount), row.currency)} ·{' '}
                    {row.beneficiary_name ?? '—'} · {row.beneficiary_phone ?? 'no phone'}
                  </p>
                  {row.beneficiary_kyc_doc_url ? (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      KYC: {row.beneficiary_kyc_doc_url}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={reviewCampaignFormAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <input type="hidden" name="campaignId" value={row.id} />
                    <input type="hidden" name="approve" value="1" />
                    <label className="text-xs text-muted-foreground">
                      Sharia endorse
                      <select
                        name="shariaEndorsed"
                        defaultValue="false"
                        className="ml-2 h-11 border border-input bg-background px-2"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">
                      Approve
                    </Button>
                  </form>
                  <form
                    action={reviewCampaignFormAction}
                    className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <input type="hidden" name="campaignId" value={row.id} />
                    <input type="hidden" name="approve" value="0" />
                    <Input
                      name="rejectionReason"
                      placeholder="Rejection reason"
                      required
                      className="min-h-11 w-full sm:w-56"
                    />
                    <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Queued disbursements</h3>
        {queued.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No pending or processing payouts.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {queued.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(Number(d.net_amount), d.currency)}
                    </p>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    → {d.beneficiary_phone} · {formatDate(d.created_at)}
                  </p>
                  {d.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Manual disburse</h3>
        {payable.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            Nothing available to disburse.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {payable.map((row) => {
              const available =
                Number(row.raised_amount) - Number(row.disbursed_amount ?? 0);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
                >
                  <div>
                    <p className="font-semibold text-foreground">{row.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Available {formatCurrency(available, row.currency)} →{' '}
                      {row.beneficiary_phone ?? 'missing phone'}
                    </p>
                  </div>
                  <form action={disburseCampaignFormAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="campaignId" value={row.id} />
                    <Input
                      name="amount"
                      type="number"
                      min={1}
                      step="0.01"
                      max={available}
                      placeholder="Full available"
                      className="min-h-11 w-36"
                    />
                    <Button type="submit" className="min-h-11">
                      Queue B2C
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Institution verification</h3>
        {orgs.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No institutions registered.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {orgs.map((org) => (
              <li key={org.id} className="space-y-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{org.name}</p>
                  <StatusBadge status={org.type} />
                  <StatusBadge status={org.verification_status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Contact {org.contact_person} · {formatDate(org.created_at)}
                </p>
                {org.registration_doc_url ? (
                  <p className="break-all text-xs text-muted-foreground">
                    Docs: {org.registration_doc_url}
                  </p>
                ) : null}
                {org.verification_status === 'pending_verification' ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={verifyInstitutionFormAction}>
                      <input type="hidden" name="institutionId" value={org.id} />
                      <input type="hidden" name="approve" value="1" />
                      <Button type="submit" className="min-h-11">
                        Verify
                      </Button>
                    </form>
                    <form action={verifyInstitutionFormAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="institutionId" value={org.id} />
                      <input type="hidden" name="approve" value="0" />
                      <Input name="rejectionReason" placeholder="Reason" className="min-h-11 w-48" />
                      <Button type="submit" variant="outline" className="min-h-11">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Fee policy</h3>
        {rows.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No campaigns yet.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {rows.map((row) => {
              const raised = Number(row.raised_amount);
              const goal = Number(row.goal_amount);
              return (
                <li key={row.id} className="space-y-4 px-4 py-4 sm:px-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{row.title}</p>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      /{row.slug} · raised {formatCurrency(raised, row.currency)} of{' '}
                      {formatCurrency(goal, row.currency)} · fee {(row.fee_bps / 100).toFixed(2)}%
                    </p>
                  </div>
                  <form
                    action={setCampaignFeePolicyFormAction}
                    className="grid gap-3 border border-border/70 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <input type="hidden" name="campaignId" value={row.id} />
                    <div className="border border-accent/30 bg-background/80 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3">
                      <p className="font-medium">{dict.admin.shariaBoardPanel}</p>
                      <p className="mt-1 text-muted-foreground">{dict.admin.shariaBoardHint}</p>
                      {!row.sharia_board_endorsed ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          {dict.admin.decisionRefRequired}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`mode-${row.id}`}>Fee mode</Label>
                      <select
                        id={`mode-${row.id}`}
                        name="feeMode"
                        defaultValue={row.fee_mode}
                        className="flex h-11 w-full border border-input bg-background px-3 text-sm"
                      >
                        <option value="donation_addon">donation_addon</option>
                        <option value="donation_deduct">donation_deduct</option>
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
                        className="min-h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Keep 0 until Sharia endorses. Then donation_addon ≤ 250 bps.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`status-${row.id}`}>Status</Label>
                      <select
                        id={`status-${row.id}`}
                        name="status"
                        defaultValue={row.status}
                        className="flex h-11 w-full border border-input bg-background px-3 text-sm"
                      >
                        <option value="draft">draft</option>
                        <option value="pending_review">pending_review</option>
                        <option value="live">live</option>
                        <option value="paused">paused</option>
                        <option value="funded">funded</option>
                        <option value="disbursed">disbursed</option>
                        <option value="closed">closed</option>
                        <option value="rejected">rejected</option>
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
                        className="flex h-11 w-full border border-input bg-background px-3 text-sm"
                      >
                        <option value="false">Pending</option>
                        <option value="true">Endorsed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ref-${row.id}`}>Decision reference</Label>
                      <Input id={`ref-${row.id}`} name="decisionReference" className="min-h-11" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`notes-${row.id}`}>Notes</Label>
                      <Input id={`notes-${row.id}`} name="notes" className="min-h-11" />
                    </div>
                    <div className="flex items-end sm:col-span-2 lg:col-span-3">
                      <Button type="submit" className="min-h-11">
                        Save fee policy
                      </Button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Recent policy decisions</h3>
        {history.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No policy events yet.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70 text-sm">
            {history.map((ev) => (
              <li key={ev.id} className="px-4 py-3 sm:px-5">
                <p className="font-semibold text-foreground">
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
