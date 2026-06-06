/** Run a Firestore query without failing the whole dashboard when one collection errors. */
export async function safeFirestoreQuery<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<{ data: T; error?: string }> {
  try {
    return { data: await loader() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[contentGrowth] ${label} failed:`, message);
    return { data: fallback, error: `${label}: ${message}` };
  }
}
