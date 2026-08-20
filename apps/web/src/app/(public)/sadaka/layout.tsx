import { createClient } from '@/lib/supabase/server';
import { SadakaSiteHeaderClient } from '@/components/sadaka-site-header-client';

export default async function PublicSadakaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[linear-gradient(180deg,#fbfcfa_0%,#eef5f0_100%)]">
      <SadakaSiteHeaderClient signedIn={Boolean(user)} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6">
        {children}
      </div>
    </div>
  );
}
