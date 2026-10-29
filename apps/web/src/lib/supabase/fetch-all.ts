/**
 * Read every row of a query in pages of 1,000 (the API's per-request maximum), so large circles
 * are not silently cut off. `page(from, to)` builds the same query with `.range(from, to)`.
 */
export async function fetchAllRowsWithError<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  { pageSize = 1000, maxRows = 50_000 } = {},
): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { rows, error };
    if (!Array.isArray(data)) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return { rows, error: null };
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<T[]> {
  return (await fetchAllRowsWithError<T>(page, options)).rows;
}

/**
 * Run an `.in(column, ids)` query in chunks: a SACCO's full id list does not fit in one request URL.
 */
export async function fetchByIdChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: unknown }>,
  chunkSize = 200,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data } = await query(ids.slice(i, i + chunkSize));
    if (Array.isArray(data)) out.push(...(data as T[]));
  }
  return out;
}
