export type ActionState = {
  success: boolean;
  message?: string;
  inviteUrl?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = { success: false };

export function mapZodFieldErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}
