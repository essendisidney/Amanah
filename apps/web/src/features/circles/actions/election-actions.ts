'use server';

import { revalidatePath } from 'next/cache';
import { callRpc } from '@/lib/supabase/rpc';

function revalidateElection(slug: string) {
  revalidatePath(`/circles/${slug}`);
  revalidatePath(`/circles/${slug}/elections`);
  revalidatePath(`/circles/${slug}/community`);
}

export async function openElectionAction(formData: FormData): Promise<void> {
  const jamiyaId = String(formData.get('jamiyaId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const seatRole = String(formData.get('seatRole') ?? '');
  const closesAtRaw = String(formData.get('closesAt') ?? '');
  if (!jamiyaId || !title || !seatRole) return;

  await callRpc('open_circle_election', {
    p_jamiya_id: jamiyaId,
    p_title: title,
    p_seat_role: seatRole,
    p_closes_at: closesAtRaw ? new Date(closesAtRaw).toISOString() : null,
  });
  revalidateElection(slug);
}

export async function nominateCandidateAction(formData: FormData): Promise<void> {
  const electionId = String(formData.get('electionId') ?? '');
  const memberId = String(formData.get('memberId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!electionId || !memberId) return;
  await callRpc('nominate_election_candidate', {
    p_election_id: electionId,
    p_member_id: memberId,
  });
  revalidateElection(slug);
}

export async function castVoteAction(formData: FormData): Promise<void> {
  const electionId = String(formData.get('electionId') ?? '');
  const candidateId = String(formData.get('candidateId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!electionId || !candidateId) return;
  await callRpc('cast_circle_vote', {
    p_election_id: electionId,
    p_candidate_id: candidateId,
  });
  revalidateElection(slug);
}

export async function closeElectionAction(formData: FormData): Promise<void> {
  const electionId = String(formData.get('electionId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  if (!electionId) return;
  await callRpc('close_circle_election', { p_election_id: electionId });
  revalidateElection(slug);
}
