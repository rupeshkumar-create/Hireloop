export async function verifyHttpUrl(
  url: string,
  opts?: { timeoutMs?: number; maxRedirects?: number }
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 7000;
  const maxRedirects = opts?.maxRedirects ?? 5;

  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const result = await tryVerifyOnce(current, timeoutMs);
    if (result.type === 'ok') return true;
    if (result.type === 'redirect' && result.location) {
      current = result.location;
      continue;
    }
    return false;
  }

  return false;
}

type VerifyOnceResult =
  | { type: 'ok' }
  | { type: 'redirect'; location: string | null }
  | { type: 'fail' };

async function tryVerifyOnce(url: string, timeoutMs: number): Promise<VerifyOnceResult> {
  const head = await tryRequest(url, 'HEAD', timeoutMs);
  if (head.type !== 'fail') return head;
  return await tryRequest(url, 'GET', timeoutMs);
}

async function tryRequest(url: string, method: 'HEAD' | 'GET', timeoutMs: number): Promise<VerifyOnceResult> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, redirect: 'manual', signal: ctrl.signal });
    if (res.status >= 200 && res.status < 400) return { type: 'ok' };
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { type: 'fail' };
      const absolute = new URL(loc, url).toString();
      return { type: 'redirect', location: absolute };
    }
    return { type: 'fail' };
  } catch {
    return { type: 'fail' };
  } finally {
    clearTimeout(timeout);
  }
}

