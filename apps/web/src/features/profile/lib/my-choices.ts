/** What get_my_choices returns: the member's opt-ins and opt-outs, and their history. */

export type NotificationCategory = 'reminders' | 'payout_alerts';
export type NotificationChannel = 'sms' | 'whatsapp' | 'email' | 'push';
export type SponsorshipStatus = 'active' | 'paused' | 'cancelled';

export type MyChoices = {
  ok: boolean;
  notifications: Array<{
    category: NotificationCategory;
    channel: NotificationChannel;
    enabled: boolean;
    updated_at: string | null;
  }>;
  circle_terms: Array<{
    jamiya_id: string;
    name: string;
    slug: string;
    current_version: number;
    accepted_version: number | null;
    accepted_at: string | null;
    up_to_date: boolean;
  }>;
  sponsorships: Array<{
    id: string;
    title: string;
    monthly_amount: number | string;
    currency: string;
    status: SponsorshipStatus;
    next_charge_date: string;
  }>;
  circle_plans: Array<{
    jamiya_id: string;
    name: string;
    slug: string;
    plan_id: string;
    plan_name: string;
    price_kes: number | string;
    status: string;
    renews_at: string | null;
    auto_renew: boolean;
  }>;
  history: ChoiceEvent[];
};

export type ChoiceEvent = {
  subject: 'notifications' | 'sponsorship' | 'circle_plan' | 'circle_terms' | 'fee_vote';
  subject_id: string | null;
  choice: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export const CATEGORY_LABELS: Record<NotificationCategory, { title: string; hint: string }> = {
  reminders: {
    title: 'Contribution reminders',
    hint: 'Before a contribution is due, and when it is late.',
  },
  payout_alerts: {
    title: 'Payout heads-up',
    hint: 'The day before your payout.',
  },
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
  push: 'App notifications',
};

const SPONSORSHIP_STATUS: Record<SponsorshipStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Stopped',
};

export function sponsorshipStatusLabel(status: SponsorshipStatus): string {
  return SPONSORSHIP_STATUS[status] ?? status;
}

/** One line for a history entry, e.g. "Turned off SMS contribution reminders". */
export function describeChoice(event: ChoiceEvent): string {
  const d = event.detail ?? {};
  const name = typeof d.name === 'string' ? d.name : 'a circle';
  switch (event.subject) {
    case 'notifications': {
      const category = CATEGORY_LABELS[d.category as NotificationCategory]?.title ?? 'messages';
      const channel = CHANNEL_LABELS[d.channel as NotificationChannel] ?? String(d.channel ?? '');
      return `${event.choice === 'opted_in' ? 'Turned on' : 'Turned off'} ${channel} ${category.toLowerCase()}`;
    }
    case 'sponsorship':
      return event.choice === 'paused'
        ? 'Paused a sponsorship'
        : event.choice === 'resumed'
          ? 'Resumed a sponsorship'
          : 'Stopped a sponsorship';
    case 'circle_plan':
      return event.choice === 'auto_renew_on'
        ? 'Turned on circle plan auto-renew'
        : 'Turned off circle plan auto-renew';
    case 'circle_terms':
      return `Accepted ${name}’s fees and terms (version ${String(d.version ?? '?')})`;
    case 'fee_vote':
      return `Voted ${event.choice === 'voted_yes' ? 'yes' : 'no'} on a fee change in ${name}`;
    default:
      return event.choice;
  }
}
