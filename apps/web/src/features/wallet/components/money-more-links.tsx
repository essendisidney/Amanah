import Link from 'next/link';
import type { Route } from 'next';
import {
  Calculator,
  ChartNoAxesCombined,
  HandHeart,
  Landmark,
  Scale,
  TrendingUp,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';

type Labels = Dictionary['wallet'];

const ITEMS: Array<{
  href: string;
  title: keyof Labels;
  hint: keyof Labels;
  icon: typeof TrendingUp;
}> = [
  { href: '/finance/goals', title: 'moreGoals', hint: 'moreGoalsDesc', icon: TrendingUp },
  { href: '/finance/qard', title: 'moreQard', hint: 'moreQardDesc', icon: Landmark },
  { href: '/finance/tawarruq', title: 'moreTawarruq', hint: 'moreTawarruqDesc', icon: Scale },
  { href: '/finance/insights', title: 'quickInsights', hint: 'moreInsightsDesc', icon: ChartNoAxesCombined },
  { href: '/finance/welfare', title: 'moreWelfare', hint: 'moreWelfareDesc', icon: HandHeart },
  { href: '/sadaka', title: 'moreSadaka', hint: 'moreSadakaDesc', icon: HandHeart },
  { href: '/zakat', title: 'moreZakat', hint: 'moreZakatDesc', icon: Calculator },
];

export function MoneyMoreLinks({ labels }: { labels: Labels }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            className="jameiyah-surface flex min-h-11 items-center gap-3 px-3 py-3 transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{labels[item.title]}</span>
              <span className="block text-xs text-muted-foreground">{labels[item.hint]}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
