import { slugify } from '@jamiya/shared';

/**
 * Allocate a unique public slug. Falls back to suffix -2, -3, … on collision.
 */
export async function allocateUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (relation: string) => any },
  name: string,
): Promise<string> {
  const base = slugify(name) || 'jamiya';
  let candidate = base;
  let attempt = 1;

  while (attempt <= 50) {
    const { data, error } = await client
      .from('jamiyas')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error((error as { message: string }).message);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}
