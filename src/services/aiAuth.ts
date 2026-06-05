let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAiAuthTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export async function getAiAuthToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  return tokenGetter();
}
