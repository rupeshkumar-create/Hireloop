import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';

const WEBHOOK_TOLERANCE_SEC = 5 * 60;

export const DODO_UPGRADE_EVENTS = new Set([
  'payment.succeeded',
  'subscription.active',
  'subscription.renewed',
]);

export const DODO_DOWNGRADE_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.canceled',
  'subscription.expired',
  'subscription.on_hold',
  'subscription.failed',
  'payment.failed',
]);

export async function readWebhookRawBody(req: IncomingMessage & { body?: unknown }): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function decodeWebhookSecret(secret: string): Buffer {
  const normalized = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(normalized, 'base64');
}

/** Standard Webhooks signature verification (Dodo Payments). */
export function verifyStandardWebhookSignature(
  rawBody: string,
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string }
): boolean {
  const webhookId = headers.id?.trim();
  const timestamp = headers.timestamp?.trim();
  const signatureHeader = headers.signature?.trim();
  if (!webhookId || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSec > WEBHOOK_TOLERANCE_SEC) return false;

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', decodeWebhookSecret(secret))
    .update(signedContent)
    .digest('base64');

  for (const part of signatureHeader.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    try {
      if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
    } catch {
      // length mismatch — try next signature
    }
  }
  return false;
}

export function extractCustomerEmail(event: Record<string, unknown>): string | undefined {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return undefined;

  const customer = data.customer as Record<string, unknown> | undefined;
  const fromCustomer = typeof customer?.email === 'string' ? customer.email : undefined;
  if (fromCustomer) return fromCustomer;

  if (typeof data.email === 'string') return data.email;
  if (typeof data.customer_email === 'string') return data.customer_email;
  return undefined;
}

export function resolvePlanFromEvent(eventType: string, event: Record<string, unknown>): 'pro' | 'free' | null {
  if (DODO_UPGRADE_EVENTS.has(eventType)) return 'pro';
  if (DODO_DOWNGRADE_EVENTS.has(eventType)) return 'free';

  if (eventType === 'subscription.updated') {
    const status = String((event.data as Record<string, unknown> | undefined)?.status || '').toLowerCase();
    if (status === 'active' || status === 'renewed') return 'pro';
    if (['cancelled', 'canceled', 'expired', 'on_hold', 'failed'].includes(status)) return 'free';
  }

  return null;
}
