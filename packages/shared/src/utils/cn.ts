/**
 * Conditional className merger without a hard dependency on clsx/tailwind-merge
 * at the shared package level. The web/ui packages may re-export with twMerge.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}
