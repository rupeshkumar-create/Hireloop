import { describe, expect, it } from 'vitest';
import {
  buildCheckoutUrl,
  isDodoPaymentReturn,
  PAYMENT_SUCCESS_PATH,
} from '../pricing';

describe('buildCheckoutUrl', () => {
  it('adds quantity, email, disableEmail, and return_url for static Dodo links', () => {
    const url = buildCheckoutUrl(
      'https://checkout.dodopayments.com/buy/pdt_d7rp85iimkphiaGBV5fxV',
      'user@example.com'
    );
    const parsed = new URL(url);

    expect(parsed.searchParams.get('quantity')).toBe('1');
    expect(parsed.searchParams.get('email')).toBe('user@example.com');
    expect(parsed.searchParams.get('disableEmail')).toBe('true');
    expect(parsed.searchParams.get('return_url')).toBe(
      `https://www.hireschema.com${PAYMENT_SUCCESS_PATH}`
    );
  });

  it('preserves existing quantity on the base URL', () => {
    const url = buildCheckoutUrl(
      'https://checkout.dodopayments.com/buy/pdt_test?quantity=1',
      'user@example.com'
    );
    expect(new URL(url).searchParams.get('quantity')).toBe('1');
  });
});

describe('isDodoPaymentReturn', () => {
  it('detects custom payment success path', () => {
    expect(isDodoPaymentReturn(new URLSearchParams('payment=success'))).toBe(true);
  });

  it('detects Dodo subscription redirect params', () => {
    expect(
      isDodoPaymentReturn(
        new URLSearchParams('subscription_id=sub_123&status=active&email=user%40example.com')
      )
    ).toBe(true);
  });

  it('ignores unrelated query params', () => {
    expect(isDodoPaymentReturn(new URLSearchParams('welcome=1'))).toBe(false);
  });
});
