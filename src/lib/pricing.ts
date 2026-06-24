/** Single source of truth for Pro pricing across landing, settings, and upsells. */
export const PRO_MONTHLY_USD = 19;
export const PRO_ANNUAL_USD = 180;

export const PRO_ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 - PRO_ANNUAL_USD / (PRO_MONTHLY_USD * 12)) * 100
);

const DEFAULT_DODO_MONTHLY =
  'https://checkout.dodopayments.com/buy/pdt_d7rp85iimkphiaGBV5fxV';
const DEFAULT_DODO_ANNUAL =
  'https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR';

/** Override in Vercel with VITE_DODO_CHECKOUT_MONTHLY when product IDs change. */
export const DODO_CHECKOUT_MONTHLY =
  import.meta.env.VITE_DODO_CHECKOUT_MONTHLY?.trim() || DEFAULT_DODO_MONTHLY;

/** Override in Vercel with VITE_DODO_CHECKOUT_ANNUAL when product IDs change. */
export const DODO_CHECKOUT_ANNUAL =
  import.meta.env.VITE_DODO_CHECKOUT_ANNUAL?.trim() || DEFAULT_DODO_ANNUAL;

export const PAYMENT_SUCCESS_PATH = '/dashboard?payment=success';

export function checkoutReturnOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://hireloop.vercel.app';
}

/** Detect Dodo redirect query params after checkout (static link return_url). */
export function isDodoPaymentReturn(params: URLSearchParams): boolean {
  if (params.get('payment') === 'success') return true;
  const status = params.get('status')?.toLowerCase();
  if (status === 'succeeded' || status === 'active') {
    return Boolean(params.get('subscription_id') || params.get('payment_id'));
  }
  return false;
}

export function buildCheckoutUrl(
  base: string,
  email: string,
  redirectPath = PAYMENT_SUCCESS_PATH
) {
  const url = new URL(base);
  if (!url.searchParams.has('quantity')) {
    url.searchParams.set('quantity', '1');
  }
  const trimmedEmail = email.trim();
  if (trimmedEmail) {
    url.searchParams.set('email', trimmedEmail);
    url.searchParams.set('disableEmail', 'true');
  }
  url.searchParams.set('return_url', `${checkoutReturnOrigin()}${redirectPath}`);
  return url.toString();
}
