const PAGE_SIZE = 250;

export async function readAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
) {
  const rows: T[] = [];
  let total: number | null = null;

  do {
    const { data, error, count } = await readPage(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    total ??= count;
    if (total === null && data.length < PAGE_SIZE) break;
  } while (total === null || rows.length < total);

  return rows;
}
