'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';
import type { ProfileActionState } from '../lib/state';
import type {
  NotificationCategory,
  NotificationChannel,
  SponsorshipStatus,
} from '../lib/my-choices';

const ERRORS: Record<string, string> = {
  UNAUTHENTICATED: 'Sign in again to change your choices.',
  INVALID_CHOICE: 'That choice is not available.',
  NOT_FOUND: 'We could not find that sponsorship.',
  SPONSORSHIP_ENDED: 'This sponsorship was stopped. Start a new one from the sponsorship page.',
  FORBIDDEN: 'Only circle officers can change this.',
  NO_PAID_PLAN: 'This circle is on the free plan, so there is nothing to renew.',
};

async function run(fn: string, args: Record<string, unknown>, done: string): Promise<ProfileActionState> {
  const { data, error } = await callRpc(fn, args);
  revalidatePath('/profile/choices');
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    const code = result?.error ?? '';
    return { success: false, message: ERRORS[code] ?? 'Could not save your choice. Try again.' };
  }
  return { success: true, message: done };
}

export async function setNotificationPreferenceAction(
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<ProfileActionState> {
  return run(
    'set_notification_preference',
    { p_category: category, p_channel: channel, p_enabled: enabled },
    enabled ? 'Turned on.' : 'Turned off. You will still see these in your in-app inbox.',
  );
}

export async function setSponsorshipStatusAction(
  sponsorshipId: string,
  status: SponsorshipStatus,
): Promise<ProfileActionState> {
  const done: Record<SponsorshipStatus, string> = {
    paused: 'Paused. No monthly charge until you resume.',
    active: 'Resumed. The next charge is on the date shown.',
    cancelled: 'Stopped. There will be no more charges.',
  };
  return run(
    'set_sponsorship_status',
    { p_sponsorship_id: sponsorshipId, p_status: status },
    done[status],
  );
}

export async function setPlanAutoRenewAction(
  jamiyaId: string,
  autoRenew: boolean,
): Promise<ProfileActionState> {
  return run(
    'set_circle_plan_auto_renew',
    { p_jamiya_id: jamiyaId, p_auto_renew: autoRenew },
    autoRenew
      ? 'Auto-renew is on. The plan renews from your wallet each month.'
      : 'Auto-renew is off. The plan ends on its renewal date and you will not be charged again.',
  );
}
