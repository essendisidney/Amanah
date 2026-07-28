'use server';

import { createClient } from '@/lib/supabase/server';
import { toSpreadsheetMl } from '@/lib/export/spreadsheet';

function csv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) =>
    /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
  ).join(',')).join('\n');
}

/** Export member details for a circle the requesting user can access. */
export async function exportCircleReportAction(slug: string): Promise<{
  filename: string;
  csv: string;
  xlsFilename: string;
  xls: string;
} | null> {
  if (!slug) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: jamiyaData } = await supabase.from('jamiyas').select('id, name, slug').eq('slug', slug).maybeSingle();
  const jamiya = jamiyaData as unknown as { id: string; name: string; slug: string } | null;
  if (!jamiya) return null;
  const { data: membershipData } = await supabase.from('members').select('role, status').eq('jamiya_id', jamiya.id).eq('user_id', user.id).maybeSingle();
  const membership = membershipData as unknown as { role: string; status: string } | null;
  if (!membership || !['circle_admin', 'chair', 'treasurer', 'secretary'].includes(String(membership.role))) return null;
  const { data: members } = await supabase.from('members').select('user_id, role, status, payout_position, joined_at').eq('jamiya_id', jamiya.id).order('payout_position');
  const rows = (members ?? []) as unknown as Array<{ user_id: string; role: string; status: string; payout_position: number | null; joined_at: string | null }>;
  const ids = rows.map((member) => member.user_id);
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, full_name, email, mpesa_phone').in('id', ids) : { data: [] };
  const profileById = new Map(((profiles ?? []) as unknown as Array<{ id: string; full_name: string | null; email: string | null; mpesa_phone: string | null }>).map((profile) => [profile.id, profile]));
  const table = [
    ['name', 'email', 'phone', 'role', 'status', 'payout_position', 'joined_at'],
    ...rows.map((member) => {
      const profile = profileById.get(member.user_id);
      return [profile?.full_name ?? '', profile?.email ?? '', profile?.mpesa_phone ?? '', member.role, member.status, String(member.payout_position ?? ''), member.joined_at ?? ''];
    }),
  ];
  return {
    filename: `${jamiya.slug}-members.csv`,
    csv: csv(table),
    xlsFilename: `${jamiya.slug}-members.xls`,
    xls: toSpreadsheetMl('Members', table),
  };
}
