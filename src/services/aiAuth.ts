let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAiAuthTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export async function getAiAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  return tokenGetter();
}

/** Authenticated fetch with one retry after refreshing the session on 401. */
export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const withToken = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  };

  const token = await getAiAuthToken();
  if (!token) throw new Error('Not authenticated');

  let response = await withToken(token);
  if (response.status !== 401) return response;

  const { forceRefreshAccessToken } = await import('../lib/supabaseSession');
  const refreshed = await forceRefreshAccessToken();
  if (!refreshed) return response;

  return withToken(refreshed);
}
