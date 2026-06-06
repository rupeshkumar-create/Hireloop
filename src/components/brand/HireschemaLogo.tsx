import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useTheme } from '../../contexts/ThemeContext';

export const HIRESCHEMA_LOGO_SRC = '/hireschema-logo.png';
export const HIRESCHEMA_LOGO_DARK_SRC = '/hireschema-logo-dark.png';
export const HIRESCHEMA_ICON_SRC = '/hireschema-icon.png';

const LOGO_ASPECT = 1024 / 180;

type HireschemaLogoProps = {
  className?: string;
  height?: number;
  to?: string;
};

export function HireschemaLogo({ className, height = 28, to }: HireschemaLogoProps) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? HIRESCHEMA_LOGO_DARK_SRC : HIRESCHEMA_LOGO_SRC;

  const img = (
    <img
      src={src}
      alt="Hireschema"
      height={height}
      width={Math.round(height * LOGO_ASPECT)}
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
