import React from 'react';
import {
  WHATSAPP_SUPPORT_PHONE_DISPLAY,
  whatsappSupportUrl,
} from '../../lib/whatsappSupport';
import { WhatsAppIcon } from './WhatsAppIcon';
import { cn } from '../../lib/utils';

type WhatsAppSupportLinkProps = {
  className?: string;
  showIcon?: boolean;
  showPhone?: boolean;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export function WhatsAppSupportLink({
  className,
  showIcon = true,
  showPhone = false,
  children,
  onClick,
}: WhatsAppSupportLinkProps) {
  const label = children ?? 'WhatsApp support';
  return (
    <a
      href={whatsappSupportUrl()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn('inline-flex items-center gap-2 transition-colors', className)}
      aria-label={`${label} on WhatsApp (${WHATSAPP_SUPPORT_PHONE_DISPLAY})`}
    >
      {showIcon ? <WhatsAppIcon className="h-4 w-4 shrink-0" /> : null}
      <span>{label}</span>
      {showPhone ? (
        <span className="text-[inherit] opacity-80">{WHATSAPP_SUPPORT_PHONE_DISPLAY}</span>
      ) : null}
    </a>
  );
}
