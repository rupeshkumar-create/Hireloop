/** Hireloop WhatsApp support — single source of truth. */
export const WHATSAPP_SUPPORT_PHONE_E164 = '917903959739';
export const WHATSAPP_SUPPORT_PHONE_DISPLAY = '+91 79039 59739';
export const WHATSAPP_SUPPORT_DEFAULT_MESSAGE = 'Hi Hireloop team';

export function whatsappSupportUrl(message = WHATSAPP_SUPPORT_DEFAULT_MESSAGE): string {
  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${WHATSAPP_SUPPORT_PHONE_E164}?${params.toString()}`;
}
