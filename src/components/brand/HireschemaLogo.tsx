import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export const HIRESCHEMA_LOGO_SRC = '/hireschema-logo.png';
export const HIRESCHEMA_ICON_SRC = '/hireschema-icon.png';

type HireschemaLogoProps = {
  className?: string;
  height?: number;
  to?: string;
};

export function HireschemaLogo({ className, height = 28, to }: HireschemaLogoProps) {
  const img = (
    <img
      src={HIRESCHEMA_LOGO_SRC}
      alt="Hireschema"
      height={height}
      width={Math.round(height * (1024 / 180))}
      className={cn('hs-brand-logo', className)}
      style={{ height, width: 'auto', maxWidth: 'none' }}
      decoding="async"
    />
  );

  if (to) {
    return (
      <Link to={to} className="hs-brand-logo-link inline-flex shrink-0 items-center no-underline">
        {img}
      </Link>
    );
  }

  return img;
}

type HireschemaIconProps = {
  className?: string;
  size?: number;
};

export function HireschemaIcon({ className, size = 32 }: HireschemaIconProps) {
  return (
    <img
      src={HIRESCHEMA_ICON_SRC}
      alt="Hireschema"
      width={size}
      height={size}
      className={cn('hs-brand-icon', className)}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
