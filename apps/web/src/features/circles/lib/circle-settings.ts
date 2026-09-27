export type CircleSettingsInput = {
  name: string;
  description?: string;
  contributionAmount: number;
  frequencyDays: number;
  maxMembers: number;
  memberCount: number;
};

export type CircleSettingsPatch = {
  name: string;
  description: string | null;
  contribution_amount: number;
  contribution_frequency_days: number;
  max_members: number;
};

/** Rules a group leader may change. Slug, kind, and status stay put. */
export function circleSettingsUpdate(
  input: CircleSettingsInput,
): { ok: true; patch: CircleSettingsPatch } | { ok: false; message: string } {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 80) {
    return { ok: false, message: 'Group name must be between 3 and 80 characters.' };
  }
  const description = (input.description ?? '').trim();
  if (description.length > 1000) {
    return { ok: false, message: 'Description must be 1000 characters or fewer.' };
  }
  if (!Number.isFinite(input.contributionAmount) || input.contributionAmount <= 0) {
    return { ok: false, message: 'Contribution must be greater than zero.' };
  }
  const frequencyDays = Math.round(input.frequencyDays);
  if (!Number.isFinite(frequencyDays) || frequencyDays < 1 || frequencyDays > 365) {
    return { ok: false, message: 'Contribution interval must be between 1 and 365 days.' };
  }
  const maxMembers = Math.round(input.maxMembers);
  if (!Number.isFinite(maxMembers) || maxMembers < 2 || maxMembers > 50) {
    return { ok: false, message: 'Member limit must be between 2 and 50.' };
  }
  if (maxMembers < input.memberCount) {
    return {
      ok: false,
      message: `Member limit cannot be below the ${input.memberCount} people already in the group.`,
    };
  }
  return {
    ok: true,
    patch: {
      name,
      description: description || null,
      contribution_amount: Math.round(input.contributionAmount * 100) / 100,
      contribution_frequency_days: frequencyDays,
      max_members: maxMembers,
    },
  };
}
