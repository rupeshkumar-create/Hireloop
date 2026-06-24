import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { BRAND_NAME } from '../../lib/brand';

type HireloopLogoProps = {
  className?: string;
  height?: number;
  to?: string;
};

/** Inline SVG wordmark — no external image assets required. */
export function HireloopLogo({ className, height = 28, to }: HireloopLogoProps) {
  const markSize = height;
  const fontSize = Math.round(height * 0.58);
  const gap = Math.round(height * 0.28);

  const logo = (
    <span
      className={cn('hs-brand-logo inline-flex shrink-0 items-center', className)}
      style={{ height, gap }}
      aria-label={BRAND_NAME}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="32" height="32" rx="8" fill="currentColor" className="text-[var(--hs-land-accent,#f97316)]" />
        <path
          d="M9 16c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M23 16c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
      <span
        className="font-display font-semibold tracking-tight text-[var(--hs-land-fg,inherit)]"
        style={{ fontSize, lineHeight: 1 }}
      >
        Hireloop
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="hs-brand-logo-link inline-flex shrink-0 items-center no-underline">
        {logo}
      </Link>
    );
  }

  return logo;
}

type HireloopIconProps = {
  className?: string;
  size?: number;
};

export function HireloopIcon({ className, size = 32 }: HireloopIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('hs-brand-icon', className)}
      aria-label={BRAND_NAME}
    >
      <rect width="32" height="32" rx="8" fill="#f97316" />
      <path
        d="M9 16c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M23 16c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
