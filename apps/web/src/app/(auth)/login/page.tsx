import type { Metadata } from 'next';
import { Alert, AlertDescription } from '@jamiya/ui';
import { AuthCard, LoginForm } from '@/features/auth';
import { callRpc } from '@/lib/supabase/rpc';
import { getDictionary } from '@/i18n/get-dictionary';
import { invitationRpcArgs } from '@/features/circles/lib/invitation-token';

export const metadata: Metadata = {
  title: 'Sign in',
};

type SearchParams = Promise<{ next?: string; error?: string; method?: string; reason?: string }>;

const IDLE_NOTE = {
  en: 'For your safety you were signed out after 7 days away. Sign in again to continue.',
  sw: 'Kwa usalama wako umetolewa baada ya siku 7 bila kutumia programu. Ingia tena kuendelea.',
};

/** True when `next` is an invite link that no longer works (checked before sign-up). */
async function isDeadInviteLink(next: string): Promise<boolean> {
  const match = next.match(/^\/invitations\/([^/?#]+)/);
  if (!match) return false;
  try {
    const { data, error } = await callRpc('preview_invitation', invitationRpcArgs(decodeURIComponent(match[1]!)));
    return Boolean(error) || !Array.isArray(data) || data.length === 0;
  } catch {
    return false;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = params.next ?? '/dashboard';
  const joining =
    next.includes('/invitations/') || next.includes('/welcome') || next.includes('redeem');
  const deadInvite = await isDeadInviteLink(next);
  const { locale } = await getDictionary();
  const idle = params.reason === 'idle';

  return (
    <AuthCard
      title={joining ? 'Join Jameiyah' : 'Welcome back'}
      description={
        joining
          ? 'Choose phone SMS, email, or Google — then continue where you left off.'
          : 'Sign in with phone SMS, email, or Google.'
      }
    >
      {idle ? (
        <Alert className="mb-4">
          <AlertDescription>{IDLE_NOTE[locale === 'sw' ? 'sw' : 'en']}</AlertDescription>
        </Alert>
      ) : null}
      {deadInvite ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            This invite link is invalid or has expired. Ask the circle officer for a fresh link
            — you can still create your account below.
          </AlertDescription>
        </Alert>
      ) : null}
      <LoginForm
        next={next}
        error={params.error}
        isReturning={!joining}
        initialMethod={params.method}
      />
    </AuthCard>
  );
}
