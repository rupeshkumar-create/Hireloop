import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  extractCustomerEmail,
  resolvePlanFromEvent,
  verifyStandardWebhookSignature,
} from '../../server/dodoWebhook';

describe('extractCustomerEmail', () => {
  it('reads nested customer email from subscription payload', () => {
    expect(
      extractCustomerEmail({
        data: { customer: { email: 'user@example.com' } },
      })
    ).toBe('user@example.com');
  });
});

describe('resolvePlanFromEvent', () => {
  it('upgrades on subscription.active', () => {
    expect(resolvePlanFromEvent('subscription.active', {})).toBe('pro');
  });

  it('downgrades on subscription.cancelled', () => {
    expect(resolvePlanFromEvent('subscription.cancelled', {})).toBe('free');
  });

  it('maps subscription.updated by status', () => {
    expect(
      resolvePlanFromEvent('subscription.updated', { data: { status: 'active' } })
    ).toBe('pro');
    expect(
      resolvePlanFromEvent('subscription.updated', { data: { status: 'cancelled' } })
    ).toBe('free');
  });
});

describe('verifyStandardWebhookSignature', () => {
  it('accepts a valid Standard Webhooks signature', () => {
    const secret = Buffer.from('super-secret-key').toString('base64');
    const webhookSecret = `whsec_${secret}`;
    const id = 'msg_123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"subscription.active"}';
    const signed = `${id}.${timestamp}.${body}`;
    const sig = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(signed)
      .digest('base64');

    expect(
      verifyStandardWebhookSignature(body, webhookSecret, {
        id,
        timestamp,
        signature: `v1,${sig}`,
      })
    ).toBe(true);
  });
});
