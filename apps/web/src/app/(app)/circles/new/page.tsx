import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { CreateCircleForm } from '@/features/circles';

export const metadata: Metadata = {
  title: 'Create circle',
};

type Props = {
  searchParams?: Promise<{ intent?: string }>;
};

export default async function CreateCirclePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const intent = params.intent === 'business' ? 'business' : params.intent === 'family' ? 'family' : null;
  const defaultSegment = intent === 'business' ? 'boda_stage' : intent === 'family' ? 'womens_circle' : 'general';
  const subtitle =
    intent === 'business'
      ? 'Set contribution rules for a stage, chama, or workplace circle. You become the circle admin automatically.'
      : intent === 'family'
        ? 'Set contribution rules for a trusted family circle. You become the circle admin automatically.'
        : 'Set contribution rules for your rotating savings circle. You become the circle admin automatically.';
  const segmentHint =
    intent === 'business'
      ? 'Tip: Boda / tuktuk stage fits many business groups; switch to General if this is a workplace chama.'
      : intent === 'family'
        ? 'Tip: Women’s circle is a common family default; switch to General if that fits better.'
        : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">New circle</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-foreground">
          Create a circle
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{subtitle}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Have an invite?{' '}
          <Link
            href={'/circles#redeem-invite' as Route}
            className="text-accent underline-offset-4 hover:underline"
          >
            Enter your code instead
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_0_rgba(26,31,28,0.04)] md:p-8">
        <CreateCircleForm defaultSegment={defaultSegment} segmentHint={segmentHint} />
      </div>
    </div>
  );
}
