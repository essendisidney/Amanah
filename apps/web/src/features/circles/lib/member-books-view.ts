export type BooksView = 'home' | 'grid' | 'member' | 'import';

export function resolveBooksView(
  raw: string | undefined,
  memberId: string | undefined,
): BooksView {
  if (raw === 'home' || raw === 'roster') return 'home';
  if (raw === 'grid' || raw === 'member' || raw === 'import') return raw;
  // Bare /books with no view → home hub (not auto-member; that crashed Enter payments).
  if (!raw) return 'home';
  return memberId ? 'member' : 'home';
}

export function booksHref(
  slug: string,
  view: BooksView,
  memberId?: string,
): string {
  const params = new URLSearchParams();
  if (view !== 'home') params.set('view', view);
  if (memberId) params.set('memberId', memberId);
  const q = params.toString();
  return q ? `/circles/${slug}/books?${q}` : `/circles/${slug}/books`;
}
