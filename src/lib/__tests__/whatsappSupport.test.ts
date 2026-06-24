import { describe, expect, it } from 'vitest';
import {
  WHATSAPP_SUPPORT_DEFAULT_MESSAGE,
  WHATSAPP_SUPPORT_PHONE_E164,
  whatsappSupportUrl,
} from '../whatsappSupport';

describe('whatsappSupport', () => {
  it('builds wa.me link with default message', () => {
    const url = whatsappSupportUrl();
    expect(url).toContain(`https://wa.me/${WHATSAPP_SUPPORT_PHONE_E164}`);
    expect(url).toContain('text=Hi+Hireloop+team');
  });
});
