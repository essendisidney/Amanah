export type ProfileActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialProfileActionState: ProfileActionState = { success: false };

export function mapProfileZodErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) result[key] = value;
  }
  return result;
}
