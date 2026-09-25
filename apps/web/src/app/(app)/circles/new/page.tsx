import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app-page';
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
      ? 'Stage, chama, or workplace. You will be the circle admin.'
      : intent === 'family'
        ? 'Family circle. You will be the circle admin.'
        : 'You will be the circle admin.';
  const segmentHint =
    intent === 'business'
      ? 'Tip: Boda / tuktuk stage fits many business groups.'
      : intent === 'family'
        ? 'Tip: Women’s circle is a common family default.'
        : null;

  return (
    <AppPage>
      <PageHeader eyebrow="New circle" title="Create a circle" subtitle={subtitle} />
      <p className="text-sm text-muted-foreground">
        Have an invite?{' '}
        <Link
          href={'/circles?redeem=1' as Route}
          className="font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Enter your code instead.
        </Link>
      </p>

      <div className="amanah-surface px-4 py-4 sm:px-5 md:p-8">
        <CreateCircleForm defaultSegment={defaultSegment} segmentHint={segmentHint} />
      </div>
    
    </AppPage>
  );
}
