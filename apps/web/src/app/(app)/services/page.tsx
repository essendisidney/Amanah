import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  Calculator,
  ChartNoAxesCombined,
  ChevronRight,
  Coins,
  HandHeart,
  Landmark,
  Scale,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { getDictionary } from '@/i18n/get-dictionary';
import { getAuthUser } from '@/lib/supabase/auth';

export const metadata: Metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

type L = { en: string; sw: string };
type Item = { href: string; icon: typeof Landmark; label: keyof Dictionary['wallet']; desc: L };

const GROUPS: Array<{ title: L; items: Item[] }> = [
  {
    title: { en: 'Borrow and grow', sw: 'Kopa na ukue' },
    items: [
      { href: '/finance/qard', icon: Landmark, label: 'moreQard', desc: { en: 'Interest-free loan from your circle', sw: 'Mkopo bila riba kutoka mduara wako' } },
      { href: '/finance/tawarruq', icon: Scale, label: 'moreTawarruq', desc: { en: 'Sharia-compliant financing for bigger needs', sw: 'Ufadhili unaofuata Sharia kwa mahitaji makubwa' } },
      { href: '/finance/goals', icon: TrendingUp, label: 'moreGoals', desc: { en: 'Save towards something that matters', sw: 'Weka akiba kwa jambo muhimu kwako' } },
      { href: '/finance/invest', icon: Coins, label: 'moreInvest', desc: { en: 'Your circle\'s shared investments', sw: 'Uwekezaji wa pamoja wa mduara wako' } },
    ],
  },
  {
    title: { en: 'Your money', sw: 'Pesa yako' },
    items: [
      { href: '/wallet?focus=withdraw#withdraw', icon: ArrowUpRight, label: 'withdraw', desc: { en: 'Send your balance to M-Pesa', sw: 'Tuma salio lako kwenda M-Pesa' } },
      { href: '/finance/insights', icon: ChartNoAxesCombined, label: 'quickInsights', desc: { en: 'Where your money went, month by month', sw: 'Pesa yako ilienda wapi, mwezi kwa mwezi' } },
    ],
  },
  {
    title: { en: 'Give and care', sw: 'Toa na ujali' },
    items: [
      { href: '/finance/welfare', icon: Users, label: 'moreWelfare', desc: { en: 'Support members when life gets hard', sw: 'Saidia wanachama wakati wa shida' } },
      { href: '/sadaka', icon: HandHeart, label: 'moreSadaka', desc: { en: 'Give sadaka to causes you trust', sw: 'Toa sadaka kwa mambo unayoyaamini' } },
      { href: '/zakat', icon: Calculator, label: 'moreZakat', desc: { en: 'Work out the zakat you owe', sw: 'Hesabu zaka unayopaswa kutoa' } },
    ],
  },
];

const HEAD = {
  en: { eyebrow: 'Services', title: 'Everything Jameiyah can do for you', intro: 'Loans, savings, giving and more, in one place.' },
  sw: { eyebrow: 'Huduma', title: 'Kila kitu Jameiyah inakufanyia', intro: 'Mikopo, akiba, sadaka na zaidi, mahali pamoja.' },
};

export default async function ServicesPage() {
  const [{ user }, { dict, locale }] = await Promise.all([getAuthUser(), getDictionary()]);
  if (!user) redirect('/login?next=/services');
  const lang = locale === 'sw' ? 'sw' : 'en';
  const h = HEAD[lang];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">{h.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{h.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{h.intro}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <section key={group.title.en} className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{group.title[lang]}</h2>
            <ul className="jameiyah-surface divide-y divide-border/60 overflow-hidden">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href as Route}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{String(dict.wallet[item.label])}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.desc[lang]}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
