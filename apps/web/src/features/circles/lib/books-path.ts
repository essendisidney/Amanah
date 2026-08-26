export function booksPath(memberId: string) {
  const params = new URLSearchParams({ view: 'member', memberId });
  return `/books?${params.toString()}`;
}
