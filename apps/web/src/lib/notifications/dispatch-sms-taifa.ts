import { sendSMS } from '@/lib/sms';
import { createServiceRoleClient } from '@/lib/supabase/service';

type OutboxRow = {
  id: string;
  recipient: string;
  body: string;
  channel: string;
};

/**
 * Drain pending SMS outbox rows using the same Taifa credentials as phone OTP
 * (Vercel `TAIFA_API_KEY` / `TAIFA_SENDER_ID`).
 */
export async function dispatchSmsOutboxViaTaifa(limit = 50): Promise<{
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc('claim_notification_outbox', {
    p_limit: limit,
    p_channel: 'sms',
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as OutboxRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const hasTaifa = Boolean((process.env.TAIFA_API_KEY ?? '').trim());

  for (const row of rows) {
    try {
      if (!hasTaifa) {
        if (process.env.REQUIRE_REAL_PROVIDERS === 'true') {
          throw new Error('TAIFA_SMS_NOT_CONFIGURED');
        }
        console.info('sms skipped (TAIFA_API_KEY not configured)', {
          id: row.id,
          to: row.recipient,
        });
        await admin.rpc('mark_outbox_sent', { p_id: row.id });
        skipped += 1;
        continue;
      }

      await sendSMS(row.recipient, row.body);
      await admin.rpc('mark_outbox_sent', { p_id: row.id });
      sent += 1;
    } catch (err) {
      await admin.rpc('mark_outbox_failed', {
        p_id: row.id,
        p_error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  return { claimed: rows.length, sent, failed, skipped };
}
