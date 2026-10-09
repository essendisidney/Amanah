import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, AlertDescription } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { AppPage, PageHeader } from '@/components/app-page';
import { MyChoicesPanel } from '@/features/profile/components/my-choices-panel';
import type { MyChoices } from '@/features/profile/lib/my-choices';

export const metadata: Metadata = {
  title: 'My choices',
};

export const dynamic = 'force-dynamic';

export default async function MyChoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/profile/choices')}`);

  const { data } = await callRpc('get_my_choices', {});
  const choices = data as MyChoices | null;

  return (
    <AppPage>
      <PageHeader
        eyebrow="You"
        title="My choices"
        subtitle="What you have opted into, and a switch to opt out. Every choice is recorded with its date."
      />
      {choices?.ok ? (
        <MyChoicesPanel choices={choices} />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>We could not load your choices. Try again in a moment.</AlertDescription>
        </Alert>
      )}
    </AppPage>
  );
}
