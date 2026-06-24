import React from 'react';
import { whatsappSupportUrl, WHATSAPP_SUPPORT_PHONE_DISPLAY } from '../../lib/whatsappSupport';
import { WhatsAppIcon } from './WhatsAppIcon';

type WhatsAppFloatingButtonProps = {
  /** Extra bottom offset when a mobile tab bar is present. */
  className?: string;
};

export function WhatsAppFloatingButton({ className = '' }: WhatsAppFloatingButtonProps) {
  return (
    <a
      href={whatsappSupportUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed z-[60] flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1ebe5d] hover:shadow-xl ${className}`}
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))', right: 'max(1.25rem, env(safe-area-inset-right))' }}
      aria-label={`Chat with Hireloop support on WhatsApp (${WHATSAPP_SUPPORT_PHONE_DISPLAY})`}
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span className="hidden sm:inline">Support</span>
    </a>
  );
}
