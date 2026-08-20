import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  contributeWelfareFormAction,
  decideWelfareClaimFormAction,
  ensureWelfareFundFormAction,
  fileWelfareClaimFormAction,
} from '@/features/finance/actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { EmptyState } from '@/features/dashboard/components/empty-state';

export const dynamic = 'force-dynamic';

type Membership = {
  jamiya_id: string;
  role: string;
  jamiya: { id: string; name: string; currency: string } | null;
};
type Fund = {
  id: string;
  jamiya_id: string;
  balance: number | string;
  currency: string;
  contribution_amount: number | string;
  jamiya: { name: string } | null;
};
type Claim = {
  id: string;
  jamiya_id: string;
  claim_type: string;
  amount: number | string;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
  claimant_id: string;
  jamiya: { name: string } | null;
};

export default async function WelfarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/welfare');

  const [{ data: memberships }, { data: fundsData }, { data: claimsData }] = await Promise.all([
    supabase
      .from('members')
      .select('jamiya_id, role, jamiya:jamiyas(id, name, currency)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('welfare_funds')
      .select('id, jamiya_id, balance, currency, contribution_amount, jamiya:jamiyas(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('welfare_claims')
      .select(
        'id, jamiya_id, claim_type, amount, currency, reason, status, created_at, claimant_id, jamiya:jamiyas(name)',
      )
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const circles = (memberships ?? []) as unknown as Membership[];
  const funds = (fundsData ?? []) as unknown as Fund[];
  const claims = (claimsData ?? []) as unknown as Claim[];
  const adminCircles = circles.filter((m) =>
    ['circle_admin', 'treasurer', 'chair'].includes(m.role),
  );
  const fundByJamiya = new Set(funds.map((f) => f.jamiya_id));
  const fundCircles = circles.filter((m) => fundByJamiya.has(m.jamiya_id));

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          <Link href={'/finance' as Route} className="hover:text-primary">
            Finance
          </Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Welfare fund
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Medical, funeral, and accident support alongside regular circle savings — especially for
          boda/tuktuk stages.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Balances</h2>
        {funds.length === 0 ? (
          <EmptyState
            title="No welfare funds yet"
            description={
              adminCircles.length > 0
                ? 'Create a fund for one of your circles below so members can contribute and claim.'
                : 'Ask a circle officer (chair, treasurer, or admin) to create a welfare fund first.'
            }
            {...(adminCircles.length === 0
              ? { actionLabel: 'Back to Finance', actionHref: '/finance' as Route }
              : {})}
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {funds.map((fund) => (
              <li key={fund.id} className="flex justify-between gap-4 py-4">
                <span>{fund.jamiya?.name ?? 'Circle'}</span>
                <strong>{formatCurrency(Number(fund.balance), fund.currency)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adminCircles.length > 0 ? (
        <section className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Create / update fund
          </h2>
          <form action={ensureWelfareFundFormAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ensureJamiya">Circle</Label>
              <select
                id="ensureJamiya"
                name="jamiyaId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {adminCircles.map((m) => (
                  <option key={m.jamiya_id} value={m.jamiya_id}>
                    {m.jamiya?.name ?? m.jamiya_id}
                    {fundByJamiya.has(m.jamiya_id) ? ' (exists)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contributionAmount">Suggested contribution (KES)</Label>
              <Input
                id="contributionAmount"
                name="contributionAmount"
                type="number"
                min={0}
                step={100}
                defaultValue={500}
              />
            </div>
            <Button type="submit">Save welfare fund</Button>
          </form>
        </section>
      ) : null}

      {fundCircles.length > 0 ? (
        <section className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Contribute
          </h2>
          <p className="text-sm text-muted-foreground">Debits your wallet into the circle fund.</p>
          <form action={contributeWelfareFormAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="contribJamiya">Circle</Label>
              <select
                id="contribJamiya"
                name="jamiyaId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {fundCircles.map((m) => (
                  <option key={m.jamiya_id} value={m.jamiya_id}>
                    {m.jamiya?.name ?? m.jamiya_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" min={100} step={100} required />
            </div>
            <Button type="submit">Contribute from wallet</Button>
          </form>
        </section>
      ) : circles.length > 0 && funds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Contribute and claim options appear after a welfare fund exists for your circle.
        </p>
      ) : null}

      {fundCircles.length > 0 ? (
        <section className="max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            File a claim
          </h2>
          <form action={fileWelfareClaimFormAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="claimJamiya">Circle</Label>
              <select
                id="claimJamiya"
                name="jamiyaId"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {fundCircles.map((m) => (
                  <option key={m.jamiya_id} value={m.jamiya_id}>
                    {m.jamiya?.name ?? m.jamiya_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claimType">Type</Label>
              <select
                id="claimType"
                name="claimType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="medical"
              >
                <option value="medical">Medical</option>
                <option value="funeral">Funeral</option>
                <option value="accident">Accident</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="claimAmount">Amount</Label>
              <Input id="claimAmount" name="amount" type="number" min={100} step={100} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" required minLength={5} rows={3} />
            </div>
            <Button type="submit">Submit claim</Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Claims</h2>
        {claims.length === 0 ? (
          <EmptyState
            title="No claims yet"
            description="When someone files a medical, funeral, or accident claim, it will show here for review."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {claims.map((claim) => {
              const canDecide =
                claim.status === 'pending' &&
                adminCircles.some((m) => m.jamiya_id === claim.jamiya_id);
              return (
                <li key={claim.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {claim.jamiya?.name ?? 'Circle'} · {claim.claim_type}
                    </p>
                    <StatusBadge status={claim.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(claim.amount), claim.currency)} ·{' '}
                    {formatDate(claim.created_at)}
                  </p>
                  <p className="text-sm">{claim.reason}</p>
                  {canDecide ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={decideWelfareClaimFormAction}>
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="approve" value="true" />
                        <Button type="submit" size="sm">
                          Approve & pay
                        </Button>
                      </form>
                      <form action={decideWelfareClaimFormAction}>
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="approve" value="false" />
                        <Button type="submit" size="sm" variant="outline">
                          Reject
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
