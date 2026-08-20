import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { cn } from '@/lib/utils';

type AmanahLogoProps = {
  href?: Route | string | null;
  className?: string;
  markOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'ink';
};

/**
 * Premium Amanah identity — jade glass seal + geometric trust bloom + refined wordmark.
 */
export function AmanahLogo({
  href = '/dashboard' as Route,
  className,
  markOnly = false,
  size = 'md',
  tone = 'brand',
}: AmanahLogoProps) {
  const markPx = size === 'lg' ? 40 : size === 'sm' ? 28 : 32;
  const textClass =
    size === 'lg'
      ? 'text-[1.7rem] tracking-[-0.035em]'
      : size === 'sm'
        ? 'text-[1.05rem] tracking-[-0.02em]'
        : 'text-[1.22rem] tracking-[-0.03em] md:text-[1.32rem]';

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <AmanahMark size={markPx} className="shrink-0" />
      {markOnly ? (
        <span className="sr-only">{APP_NAME}</span>
      ) : (
        <span
          className={cn(
            'font-[family-name:var(--font-display)] font-semibold leading-none',
            textClass,
            tone === 'brand' ? 'text-primary' : 'text-foreground',
          )}
        >
          {APP_NAME}
        </span>
      )}
    </span>
  );

  if (href == null) return content;

  return (
    <Link
      href={href as Route}
      className="inline-flex min-w-0 transition-opacity hover:opacity-90 active:opacity-80"
      aria-label={APP_NAME}
    >
      {content}
    </Link>
  );
}

export function AmanahMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = `am${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('drop-shadow-[0_6px_14px_rgba(25,184,121,0.2)]', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-seal`} x1="8" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4AD49A" />
          <stop offset="0.5" stopColor="#19B879" />
          <stop offset="1" stopColor="#0E8F58" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="14" y1="6" x2="44" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="1.5" y="1.5" width="61" height="61" rx="17.5" fill={`url(#${uid}-seal)`} />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="16.5"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.25"
      />
      <ellipse cx="28" cy="18" rx="18" ry="10" fill={`url(#${uid}-shine)`} />

      {/* Four-petal trust bloom */}
      <g fill="#ffffff">
        <path d="M32 11c3.4 6.4 7 11.2 7 17.2a7 7 0 1 1-14 0c0-6 3.6-10.8 7-17.2Z" />
        <path d="M32 53c-3.4-6.4-7-11.2-7-17.2a7 7 0 1 1 14 0c0 6-3.6 10.8-7 17.2Z" />
        <path d="M11 32c6.4-3.4 11.2-7 17.2-7a7 7 0 1 1 0 14c-6 0-10.8-3.6-17.2-7Z" />
        <path d="M53 32c-6.4 3.4-11.2 7-17.2 7a7 7 0 1 1 0-14c6 0 10.8 3.6 17.2 7Z" />
        <circle cx="32" cy="32" r="6.25" />
      </g>
      <circle cx="32" cy="32" r="2.6" fill="#0E8F58" fillOpacity="0.35" />
    </svg>
  );
}
