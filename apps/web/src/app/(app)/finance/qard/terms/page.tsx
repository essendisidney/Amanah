import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@jamiya/shared';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { AppPage, PageHeader } from '@/components/app-page';
import { getDictionary } from '@/i18n/get-dictionary';
import type { CircleTermsView } from '@/features/circles/lib/circle-terms';

export const metadata: Metadata = {
  title: 'Qard Hassan terms',
};

export const dynamic = 'force-dynamic';

/** The version members sign when they accept a loan (qard_loans.agreement_version). */
const AGREEMENT_VERSION = 'v1';

type CircleCharges = { lateFixed: number; latePct: number; fee: number; currency: string };

const COPY = {
  en: {
    eyebrow: 'Money · Member loan',
    title: `Qard Hassan loan terms (${AGREEMENT_VERSION})`,
    subtitle: 'What you agree to when you sign for an interest-free loan from your circle.',
    back: 'Back to member loans',
    circle: 'Terms for',
    sections: (c: CircleCharges | null, money: (n: number) => string) => [
      {
        heading: '1. What the loan is',
        body: [
          'A Qard Hassan is a goodwill loan from money your circle has pooled. You repay exactly what you borrowed. There is no interest, no profit and no charge for time.',
          c && c.fee > 0
            ? `Your circle charges a one-off loan facilitation fee of ${money(c.fee)} per loan, taken from your Jameiyah wallet when the loan is approved. It is a flat amount: it does not grow with the loan size or with time, and it is only charged if you accepted it in the circle's terms.`
            : 'Your circle charges no loan fee.',
        ],
      },
      {
        heading: '2. How much you can borrow',
        body: [
          'Up to half of what you have paid into the circle on schedule (for share circles, plus half your recorded contributions and a tenth of your shares), minus what you still owe the circle, and never more than the circle can lend at the time.',
        ],
      },
      {
        heading: '3. Approval and guarantors',
        body: [
          'You sign this agreement by typing your full name. A circle officer then approves or rejects the request. If you named guarantors (kafala), they must accept before the loan can be approved.',
          'When approved, the money is paid into your Jameiyah wallet.',
        ],
      },
      {
        heading: '4. Repaying',
        body: [
          'You repay in the number of monthly instalments you chose. The whole loan is due 30 days for each instalment after approval (for example, 4 instalments: 120 days).',
          'You repay from your Jameiyah wallet at any time. Repaying early is welcome and costs nothing.',
        ],
      },
      {
        heading: '5. If you repay late',
        body: [
          c && (c.lateFixed > 0 || c.latePct > 0)
            ? `Your circle's late loan penalty is ${[c.lateFixed > 0 ? money(c.lateFixed) : null, c.latePct > 0 ? `${c.latePct}% of the amount still owed` : null].filter(Boolean).join(' + ')}, assessed once a day while the loan is overdue. It is only charged if you accepted it in the circle's terms, and never more than the amount you accepted. Penalties are paid to the circle.`
            : 'Your circle has no late loan penalty.',
          'While a loan is overdue you cannot borrow again, from the circle or from Jameiyah.',
        ],
      },
      {
        heading: '6. If you cannot repay',
        body: [
          'Talk to your circle officers early. An officer can mark the loan as defaulted; your guarantors are then told and become answerable to the circle under its rules. You cannot leave the circle while a loan is open.',
        ],
      },
      {
        heading: '7. Your record',
        body: [
          'Jameiyah keeps the agreement version, your typed name and the date you signed with the loan. Your circle officers and you can see them. Disputes go to your circle officers first, then to Jameiyah support.',
        ],
      },
    ],
  },
  sw: {
    eyebrow: 'Pesa · Mkopo wa mwanachama',
    title: `Masharti ya mkopo wa Qard Hassan (${AGREEMENT_VERSION})`,
    subtitle: 'Unachokubali unaposaini mkopo bila riba kutoka mduara wako.',
    back: 'Rudi kwenye mikopo',
    circle: 'Masharti ya',
    sections: (c: CircleCharges | null, money: (n: number) => string) => [
      {
        heading: '1. Mkopo huu ni nini',
        body: [
          'Qard Hassan ni mkopo wa wema kutoka pesa za pamoja za mduara wako. Unarudisha kiasi ulichokopa tu. Hakuna riba, faida wala malipo ya muda.',
          c && c.fee > 0
            ? `Mduara wako unatoza ada moja ya kuwezesha mkopo ya ${money(c.fee)} kwa kila mkopo, inayotolewa kwenye pochi yako ya Jameiyah mkopo unapoidhinishwa. Ni kiasi kimoja kisichobadilika: haiongezeki kwa ukubwa wa mkopo wala kwa muda, na inatozwa tu kama uliikubali kwenye masharti ya mduara.`
            : 'Mduara wako hautozi ada ya mkopo.',
        ],
      },
      {
        heading: '2. Unaweza kukopa kiasi gani',
        body: [
          'Hadi nusu ya ulicholipa kwenye mduara kwa ratiba (kwa miduara ya hisa, pamoja na nusu ya michango iliyorekodiwa na sehemu ya kumi ya hisa zako), ukiondoa unachodaiwa bado, na kamwe si zaidi ya kile mduara unaweza kukopesha wakati huo.',
        ],
      },
      {
        heading: '3. Idhini na wadhamini',
        body: [
          'Unasaini makubaliano haya kwa kuandika jina lako kamili. Kisha afisa wa mduara anaidhinisha au kukataa ombi. Kama ulitaja wadhamini (kafala), lazima wakubali kabla mkopo kuidhinishwa.',
          'Ukiidhinishwa, pesa zinaingia kwenye pochi yako ya Jameiyah.',
        ],
      },
      {
        heading: '4. Kulipa',
        body: [
          'Unalipa kwa idadi ya awamu za kila mwezi ulizochagua. Mkopo wote unadaiwa siku 30 kwa kila awamu baada ya idhini (mfano, awamu 4: siku 120).',
          'Unalipa kutoka pochi yako ya Jameiyah wakati wowote. Kulipa mapema kunakaribishwa na hakuna gharama.',
        ],
      },
      {
        heading: '5. Ukichelewa kulipa',
        body: [
          c && (c.lateFixed > 0 || c.latePct > 0)
            ? `Adhabu ya mduara wako ya kuchelewa kulipa mkopo ni ${[c.lateFixed > 0 ? money(c.lateFixed) : null, c.latePct > 0 ? `${c.latePct}% ya kiasi kinachodaiwa bado` : null].filter(Boolean).join(' + ')}, inayohesabiwa mara moja kwa siku mkopo ukiwa umechelewa. Inatozwa tu kama uliikubali kwenye masharti ya mduara, na kamwe si zaidi ya ulichokubali. Adhabu zinalipwa kwa mduara.`
            : 'Mduara wako hauna adhabu ya kuchelewa kulipa mkopo.',
          'Mkopo ukiwa umechelewa huwezi kukopa tena, kutoka mduara wala kutoka Jameiyah.',
        ],
      },
      {
        heading: '6. Usipoweza kulipa',
        body: [
          'Ongea na maafisa wa mduara mapema. Afisa anaweza kuweka mkopo kama ulioshindwa kulipwa; wadhamini wako wanaarifiwa na kuwajibika kwa mduara kulingana na kanuni zake. Huwezi kuondoka kwenye mduara ukiwa na mkopo ambao haujalipwa.',
        ],
      },
      {
        heading: '7. Kumbukumbu yako',
        body: [
          'Jameiyah inahifadhi toleo la makubaliano, jina uliloandika na tarehe uliyosaini pamoja na mkopo. Wewe na maafisa wa mduara mnaweza kuviona. Malalamiko yanaanza kwa maafisa wa mduara, kisha msaada wa Jameiyah.',
        ],
      },
    ],
  },
} as const;

type Props = { searchParams?: Promise<{ jamiyaId?: string }> };

export default async function QardTermsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/finance/qard/terms');

  const params = (await searchParams) ?? {};
  const { locale } = await getDictionary();
  const t = COPY[locale === 'sw' ? 'sw' : 'en'];

  const { data: memberships } = await supabase
    .from('members')
    .select('jamiya_id, jamiya:jamiyas(name)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  const circles = ((memberships ?? []) as unknown as Array<{
    jamiya_id: string;
    jamiya: { name: string } | { name: string }[] | null;
  }>).map((m) => ({
    id: m.jamiya_id,
    name: (Array.isArray(m.jamiya) ? m.jamiya[0]?.name : m.jamiya?.name) ?? 'Circle',
  }));
  const selected = circles.find((c) => c.id === params.jamiyaId?.trim()) ?? circles[0] ?? null;

  let charges: CircleCharges | null = null;
  if (selected) {
    const { data } = await callRpc('get_circle_terms', { p_jamiya_id: selected.id });
    const terms = (data as CircleTermsView | null)?.terms;
    if (terms) {
      charges = {
        lateFixed: Number(terms.late_loan_penalty_fixed ?? 0),
        latePct: Number(terms.late_loan_penalty_pct ?? 0),
        fee: Number(terms.qard_fee_amount ?? 0),
        currency: terms.currency ?? 'KES',
      };
    }
  }
  const money = (n: number) => formatCurrency(n, charges?.currency ?? 'KES');

  return (
    <AppPage>
      <PageHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

      {circles.length > 1 ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.circle}</span>
          {circles.map((c) => (
            <Link
              key={c.id}
              href={`/finance/qard/terms?jamiyaId=${c.id}` as Route}
              aria-current={c.id === selected?.id ? 'page' : undefined}
              className={
                c.id === selected?.id
                  ? 'rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground'
                  : 'rounded-full border border-border px-3 py-1'
              }
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : selected ? (
        <p className="text-sm text-muted-foreground">
          {t.circle} <span className="font-semibold text-foreground">{selected.name}</span>
        </p>
      ) : null}

      <article className="jameiyah-surface max-w-3xl space-y-6 px-5 py-6">
        {t.sections(charges, money).map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-foreground/90">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>

      <Link
        href={(selected ? `/finance/qard?jamiyaId=${selected.id}` : '/finance/qard') as Route}
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t.back}
      </Link>
    </AppPage>
  );
}
