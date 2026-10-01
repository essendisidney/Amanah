import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import {
  acceptQardAgreementFormAction,
  decideQardFormAction,
  repayQardFormAction,
  requestQardFormAction,
  respondQardGuaranteeFormAction,
} from '@/features/finance/actions';
import { EmptyState } from '@/features/dashboard/components/empty-state';
import { getDictionary } from '@/i18n/get-dictionary';

const money = (n: number) => formatCurrency(n, 'KES');

const COPY = {
  en: {
    eyebrow: 'Money',
    title: 'Member loan',
    intro: 'Interest-free. The amount you can ask for depends on what you have already paid in, minus what you still owe.',
    joinTitle: 'Join a circle first',
    joinDesc: 'Qard is available inside an active circle.',
    circles: 'Circles',
    overdue: 'Clear the overdue loan before asking for more.',
    canBorrow: (a: number) => `You can borrow up to ${money(a)}.`,
    payFirst: 'Pay into the circle before you can ask for a loan.',
    payFirstLong: 'Pay into the circle before you can ask for a loan. What you still owe is already counted.',
    capNA: 'Cap unavailable',
    capShare: (sp: number, bc: number, sh: number) =>
      `Schedule paid ${money(sp)} · book contributions ${money(bc)} · shares ${money(sh)}. `,
    capPlain: (sp: number) => `Schedule paid ${money(sp)}. `,
    capRoom: (owed: number, room: number) => `Still owing ${money(owed)}. The circle can still lend ${money(room)}.`,
    guaranteeTitle: 'Guarantee requests for you',
    kafala: 'kafala request',
    accept: 'Accept',
    decline: 'Decline',
    askTitle: 'Ask for a loan',
    circle: 'Circle',
    amount: 'Amount (KES)',
    installments: 'Monthly installments',
    purpose: 'Purpose',
    send: 'Send request',
    pendingTitle: 'Pending approvals',
    requested: 'requested',
    signed: ' · agreement signed',
    awaiting: ' · awaiting borrower agreement',
    approve: 'Approve',
    reject: 'Reject',
    yourLoans: 'Your loans',
    topUp: 'Top up Money',
    remaining: 'remaining',
    due: 'due',
    agreement:
      'Qard Hassan facility agreement (v1): interest-free loan repaid in agreed installments. I accept the circle rules and repayment schedule.',
    signer: 'Full name as signature',
    acceptAgreement: 'Accept agreement',
    agreementSigned: 'Agreement signed',
    by: 'by',
    repayNote: 'This comes from your Money balance. Add money with M-Pesa first if it is short.',
    repay: 'Repay',
    noLoans: 'No loans yet',
    noLoansDesc: 'Ask for an interest-free loan from this circle. The treasurer approves, then you repay.',
  },
  sw: {
    eyebrow: 'Pesa',
    title: 'Mkopo wa mwanachama',
    intro: 'Bila riba. Kiasi unachoweza kuomba kinategemea ulichokwisha lipa, ukiondoa unachodaiwa bado.',
    joinTitle: 'Jiunge na mduara kwanza',
    joinDesc: 'Qard inapatikana ndani ya mduara unaoendelea.',
    circles: 'Miduara',
    overdue: 'Maliza mkopo uliochelewa kabla ya kuomba zaidi.',
    canBorrow: (a: number) => `Unaweza kukopa hadi ${money(a)}.`,
    payFirst: 'Lipa kwenye mduara kwanza kabla ya kuomba mkopo.',
    payFirstLong: 'Lipa kwenye mduara kwanza kabla ya kuomba mkopo. Unachodaiwa bado kimeshahesabiwa.',
    capNA: 'Kikomo hakipatikani',
    capShare: (sp: number, bc: number, sh: number) =>
      `Umelipa kwa ratiba ${money(sp)} · michango kwenye vitabu ${money(bc)} · hisa ${money(sh)}. `,
    capPlain: (sp: number) => `Umelipa kwa ratiba ${money(sp)}. `,
    capRoom: (owed: number, room: number) => `Bado unadaiwa ${money(owed)}. Mduara bado unaweza kukopesha ${money(room)}.`,
    guaranteeTitle: 'Maombi ya udhamini kwako',
    kafala: 'ombi la kafala',
    accept: 'Kubali',
    decline: 'Kataa',
    askTitle: 'Omba mkopo',
    circle: 'Mduara',
    amount: 'Kiasi (KES)',
    installments: 'Awamu za kila mwezi',
    purpose: 'Sababu',
    send: 'Tuma ombi',
    pendingTitle: 'Yanayosubiri idhini',
    requested: 'imeombwa',
    signed: ' · makubaliano yamesainiwa',
    awaiting: ' · inasubiri makubaliano ya mkopaji',
    approve: 'Idhinisha',
    reject: 'Kataa',
    yourLoans: 'Mikopo yako',
    topUp: 'Ongeza Pesa',
    remaining: 'imebaki',
    due: 'inadaiwa',
    agreement:
      'Makubaliano ya Qard Hassan (v1): mkopo bila riba unaolipwa kwa awamu zilizokubaliwa. Nakubali kanuni za mduara na ratiba ya kulipa.',
    signer: 'Jina kamili kama sahihi',
    acceptAgreement: 'Kubali makubaliano',
    agreementSigned: 'Makubaliano yamesainiwa',
    by: 'na',
    repayNote: 'Hii inatoka kwenye salio lako la Pesa. Ongeza pesa kwa M-Pesa kwanza kama haitoshi.',
    repay: 'Lipa',
    noLoans: 'Bado huna mkopo',
    noLoansDesc: 'Omba mkopo bila riba kutoka mduara huu. Mweka hazina anaidhinisha, kisha unalipa.',
  },
} as const;

export const dynamic = 'force-dynamic';

type Loan = {
  id: string;
  jamiya_id: string;
  borrower_id: string;
  amount: number | string;
  amount_repaid: number | string;
  currency: string;
  purpose: string;
  status: string;
  due_date: string | null;
  agreement_accepted_at?: string | null;
  agreement_signer_name?: string | null;
};

type Membership = {
  jamiya_id: string;
  role: string;
  jamiya: { name: string } | null;
};

type Props = {
  searchParams?: Promise<{ jamiyaId?: string }>;
};

export default async function QardPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/qard');

  const params = (await searchParams) ?? {};
  const { locale } = await getDictionary();
  const t = COPY[locale === 'sw' ? 'sw' : 'en'];
  const preferredJamiyaId = params.jamiyaId?.trim() || '';

  const [
    { data: loansData },
    { data: membershipsData },
    { data: pendingData },
    { data: pendingGuaranteeData },
  ] = await Promise.all([
    supabase
      .from('qard_loans')
      .select(
        'id, jamiya_id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at, agreement_signer_name',
      )
      .eq('borrower_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('members')
      .select('jamiya_id, role, jamiya:jamiyas(name)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('qard_loans')
      .select(
        'id, jamiya_id, borrower_id, amount, amount_repaid, currency, purpose, status, due_date, agreement_accepted_at',
      )
      .eq('status', 'requested')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('qard_guarantees')
      .select(
        'id, loan_id, status, loan:qard_loans(id, amount, currency, purpose, status, borrower_id)',
      )
      .eq('guarantor_user_id', user.id)
      .eq('status', 'pending')
      .limit(30),
  ]);

  const loans = (loansData ?? []) as unknown as Loan[];
  const memberships = (membershipsData ?? []) as unknown as Membership[];
  const defaultJamiyaId = memberships.some((m) => m.jamiya_id === preferredJamiyaId)
    ? preferredJamiyaId
    : memberships[0]?.jamiya_id ?? '';
  const officerCircleIds = new Set(
    memberships
      .filter((m) => ['circle_admin', 'treasurer', 'chair'].includes(m.role))
      .map((m) => m.jamiya_id),
  );
  const pendingForOfficer = ((pendingData ?? []) as unknown as Loan[]).filter((loan) =>
    officerCircleIds.has(loan.jamiya_id),
  );
  const hasActiveRepay = loans.some((loan) => loan.status === 'active');

  const caps = await Promise.all(
    memberships.map(async (m) => {
      const { data } = await supabase.rpc('qard_cap_for_jamiya', {
        p_jamiya_id: m.jamiya_id,
      });
      const result = data as {
        ok?: boolean;
        cap?: number;
        paid_total?: number;
        is_share?: boolean;
        schedule_paid?: number;
        book_contributions?: number;
        shares?: number;
        qard_owed?: number;
        circle_room?: number;
        personal_room?: number;
        overdue?: boolean;
      } | null;
      return {
        jamiyaId: m.jamiya_id,
        name: m.jamiya?.name ?? 'Circle',
        cap: result?.ok ? Number(result.cap ?? 0) : null,
        paid: result?.ok ? Number(result.paid_total ?? 0) : null,
        isShare: Boolean(result?.is_share),
        schedulePaid: Number(result?.schedule_paid ?? 0),
        bookContributions: Number(result?.book_contributions ?? 0),
        shares: Number(result?.shares ?? 0),
        owed: Number(result?.qard_owed ?? 0),
        circleRoom: Number(result?.circle_room ?? 0),
        personalRoom: Number(result?.personal_room ?? 0),
        overdue: Boolean(result?.overdue),
      };
    }),
  );

  const canRequestLoan = caps.some((cap) => (cap.cap ?? 0) >= 100);

  const pendingGuarantees = (
    (pendingGuaranteeData ?? []) as unknown as Array<{
      id: string;
      loan:
        | { amount: number | string; currency: string; purpose: string; status: string }
        | Array<{ amount: number | string; currency: string; purpose: string; status: string }>
        | null;
    }>
  ).filter((row) => {
    const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan;
    return loan?.status === 'requested';
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          {t.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.intro}
        </p>
      </div>

      {memberships.length === 0 ? (
        <EmptyState
          title={t.joinTitle}
          description={t.joinDesc}
          actionLabel={t.circles}
          actionHref={'/circles' as Route}
        />
      ) : null}

      {caps.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {caps.map((cap) => (
            <li key={cap.jamiyaId} className="jameiyah-surface px-4 py-3 sm:px-5">
              <p className="text-sm font-medium">{cap.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cap.cap != null
                  ? cap.overdue
                    ? t.overdue
                    : cap.cap >= 100
                      ? t.canBorrow(cap.cap)
                      : t.payFirst
                  : t.capNA}
              </p>
              {cap.cap != null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {cap.isShare
                    ? t.capShare(cap.schedulePaid, cap.bookContributions, cap.shares)
                    : t.capPlain(cap.schedulePaid)}
                  {t.capRoom(cap.owed, cap.circleRoom)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pendingGuarantees.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {t.guaranteeTitle}
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {pendingGuarantees.map((row) => {
              const loan = Array.isArray(row.loan) ? row.loan[0] : row.loan;
              if (!loan) return null;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <p className="font-medium">{loan.purpose}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(Number(loan.amount), loan.currency)} · {t.kafala}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={respondQardGuaranteeFormAction}>
                      <input type="hidden" name="guaranteeId" value={row.id} />
                      <input type="hidden" name="accept" value="true" />
                      <Button type="submit" size="sm" className="min-h-11">
                        {t.accept}
                      </Button>
                    </form>
                    <form action={respondQardGuaranteeFormAction}>
                      <input type="hidden" name="guaranteeId" value={row.id} />
                      <input type="hidden" name="accept" value="false" />
                      <Button type="submit" size="sm" variant="destructive" className="min-h-11">
                        {t.decline}
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {memberships.length > 0 && !canRequestLoan ? (
        <section className="max-w-xl space-y-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {t.askTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.payFirstLong}
          </p>
        </section>
      ) : null}

      {memberships.length > 0 && canRequestLoan ? (
        <form
          action={requestQardFormAction}
          className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6"
        >
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {t.askTitle}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="jamiyaId">{t.circle}</Label>
            <select
              id="jamiyaId"
              name="jamiyaId"
              required
              defaultValue={defaultJamiyaId}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.jamiya_id} value={m.jamiya_id}>
                  {m.jamiya?.name ?? 'Circle'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">{t.amount}</Label>
            <Input id="amount" name="amount" type="number" min="100" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installments">{t.installments}</Label>
            <Input
              id="installments"
              name="installments"
              type="number"
              min="1"
              max="24"
              defaultValue="4"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">{t.purpose}</Label>
            <Textarea id="purpose" name="purpose" minLength={5} required />
          </div>
          <Button type="submit" className="min-h-11">
            {t.send}
          </Button>
        </form>
      ) : null}

      {pendingForOfficer.length > 0 ? (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {t.pendingTitle}
          </h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {pendingForOfficer.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div>
                  <p className="font-medium">{loan.purpose}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(Number(loan.amount), loan.currency)} · {t.requested}
                    {loan.agreement_accepted_at ? t.signed : t.awaiting}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="true" />
                    <Button
                      type="submit"
                      size="sm"
                      className="min-h-11"
                      disabled={!loan.agreement_accepted_at}
                    >
                      {t.approve}
                    </Button>
                  </form>
                  <form action={decideQardFormAction}>
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="approve" value="false" />
                    <Button type="submit" size="sm" variant="destructive" className="min-h-11">
                      {t.reject}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {t.yourLoans}
          </h2>
          {hasActiveRepay ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={'/wallet?focus=top-up#top-up' as Route}>{t.topUp}</Link>
            </Button>
          ) : null}
        </div>
        {loans.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {loans.map((loan) => {
              const due = Number(loan.amount) - Number(loan.amount_repaid);
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <p className="font-medium">{loan.purpose}</p>
                    <p className="text-sm text-muted-foreground">
                      {loan.status} · {formatCurrency(due, loan.currency)} {t.remaining}
                      {loan.due_date ? ` · ${t.due} ${loan.due_date}` : ''}
                    </p>
                  </div>
                  {loan.status === 'requested' && !loan.agreement_accepted_at ? (
                    <form
                      action={acceptQardAgreementFormAction}
                      className="max-w-md space-y-2 rounded-md border border-border p-3"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <p className="text-xs text-muted-foreground">
                        {t.agreement}
                      </p>
                      <Input
                        name="signerName"
                        placeholder={t.signer}
                        required
                        minLength={2}
                      />
                      <Button type="submit" size="sm" className="min-h-11">
                        {t.acceptAgreement}
                      </Button>
                    </form>
                  ) : null}
                  {loan.status === 'requested' && loan.agreement_accepted_at ? (
                    <p className="text-xs text-muted-foreground">
                      {t.agreementSigned}
                      {loan.agreement_signer_name ? ` ${t.by} ${loan.agreement_signer_name}` : ''}
                    </p>
                  ) : null}
                  {loan.status === 'active' ? (
                    <form
                      action={repayQardFormAction} data-step-up="large"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="loanId" value={loan.id} />
                      <p className="w-full text-xs text-muted-foreground">
                        {t.repayNote}
                      </p>
                      <Input
                        name="amount"
                        type="number"
                        min="1"
                        max={due}
                        placeholder={t.repay}
                        required
                        className="h-11 w-28"
                      />
                      <Button type="submit" size="sm" className="min-h-11">
                        {t.repay}
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={t.noLoans}
            description={
              canRequestLoan
                ? t.noLoansDesc
                : t.payFirst
            }
          />
        )}
      </section>
    </div>
  );
}
