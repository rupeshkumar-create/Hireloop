import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export const HIRESCHEMA_LOGO_SRC = '/hireschema-logo.png';
export const HIRESCHEMA_LOGO_DARK_SRC = '/hireschema-logo-dark.png';
export const HIRESCHEMA_ICON_SRC = '/hireschema-icon.png';

const LOGO_ASPECT = 1024 / 180;

type HireschemaLogoProps = {
  className?: string;
  height?: number;
  to?: string;
};

function BrandLogoImages({ className, height }: { className?: string; height: number }) {
  const shared = {
    alt: 'Hireschema',
    height,
    width: Math.round(height * LOGO_ASPECT),
    style: { height, width: 'auto', maxWidth: 'none' } as const,
    decoding: 'async' as const,
  };

  return (
    <>
      <img
        {...shared}
        src={HIRESCHEMA_LOGO_SRC}
        className={cn('hs-brand-logo dark:hidden', className)}
      />
      <img
        {...shared}
        src={HIRESCHEMA_LOGO_DARK_SRC}
        className={cn('hs-brand-logo hidden dark:block', className)}
      />
    </>
  );
}

export function HireschemaLogo({ className, height = 28, to }: HireschemaLogoProps) {
  const logos = <BrandLogoImages className={className} height={height} />;

  if (to) {
    return (
      <Link to={to} className="hs-brand-logo-link inline-flex shrink-0 items-center no-underline">
        {logos}
      </Link>
    );
  }

  return logos;
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
