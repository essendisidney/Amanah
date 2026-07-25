export type CreateJamiyaActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialCreateJamiyaState: CreateJamiyaActionState = {
  success: false,
};

export function mapCreateJamiyaZodErrors(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): Record<string, string[]> {
  const flattened = error.flatten().fieldErrors;
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
}
