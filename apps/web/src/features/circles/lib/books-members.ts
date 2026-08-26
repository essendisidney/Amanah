/** Member statuses included on officer payment / books screens. */
export const BOOKS_MEMBER_STATUSES = ['active', 'invited', 'suspended'] as const;

export function isBooksMember(status: string) {
  return (BOOKS_MEMBER_STATUSES as readonly string[]).includes(status);
}
