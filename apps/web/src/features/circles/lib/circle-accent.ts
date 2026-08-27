const ACCENTS = ['amanah-circle-mint', 'amanah-circle-blue', 'amanah-circle-lavender'] as const;

export function circleAccentClass(slug: string): (typeof ACCENTS)[number] {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash + slug.charCodeAt(i)) % ACCENTS.length;
  }
  return ACCENTS[hash]!;
}
