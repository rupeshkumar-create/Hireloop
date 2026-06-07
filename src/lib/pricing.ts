/** Single source of truth for Pro pricing across landing, settings, and upsells. */
export const PRO_MONTHLY_USD = 9;
export const PRO_ANNUAL_USD = 79;

export const DODO_CHECKOUT_MONTHLY =
  'https://checkout.dodopayments.com/buy/pdt_0Ncd07LOU49HVOMyEEY6D?email=';
export const DODO_CHECKOUT_ANNUAL =
  'https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR?email=';

export function buildCheckoutUrl(base: string, email: string, redirectPath = '/dashboard?payment=success') {
  const redirect = encodeURIComponent(
    typeof window !== 'undefined'
      ? `${window.location.origin}${redirectPath}`
      : `https://www.hireschema.com${redirectPath}`
  );
  return `${base}${encodeURIComponent(email || '')}&redirect_url=${redirect}`;
}
