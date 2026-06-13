/** Single source of truth for Pro pricing across landing, settings, and upsells. */
export const PRO_MONTHLY_USD = 19;
export const PRO_ANNUAL_USD = 180;

export const PRO_ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 - PRO_ANNUAL_USD / (PRO_MONTHLY_USD * 12)) * 100
);

const DEFAULT_DODO_MONTHLY =
  'https://checkout.dodopayments.com/buy/pdt_0Ncd07LOU49HVOMyEEY6D?email=';
const DEFAULT_DODO_ANNUAL =
  'https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR?email=';

/** Override in Vercel with VITE_DODO_CHECKOUT_MONTHLY when product IDs change. */
export const DODO_CHECKOUT_MONTHLY =
  import.meta.env.VITE_DODO_CHECKOUT_MONTHLY?.trim() || DEFAULT_DODO_MONTHLY;

/** Override in Vercel with VITE_DODO_CHECKOUT_ANNUAL when product IDs change. */
export const DODO_CHECKOUT_ANNUAL =
  import.meta.env.VITE_DODO_CHECKOUT_ANNUAL?.trim() || DEFAULT_DODO_ANNUAL;

export function buildCheckoutUrl(base: string, email: string, redirectPath = '/dashboard?payment=success') {
  const redirect = encodeURIComponent(
    typeof window !== 'undefined'
      ? `${window.location.origin}${redirectPath}`
      : `https://www.hireschema.com${redirectPath}`
  );
  return `${base}${encodeURIComponent(email || '')}&redirect_url=${redirect}`;
}
