import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { cn } from '@/lib/utils';

type JameiyahLogoProps = {
  href?: Route | string | null;
  className?: string;
  markOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Kept for call-site compatibility; wordmark colour comes from the brand asset. */
  tone?: 'brand' | 'ink';
};

/**
 * Jameiyah identity — official lockup (green + gold).
 */
export function JameiyahLogo({
  href = '/dashboard' as Route,
  className,
  markOnly = false,
  size = 'md',
}: JameiyahLogoProps) {
  const height = size === 'lg' ? 48 : size === 'sm' ? 28 : 36;
  const width = markOnly ? height : Math.round(height * 3.6);

  const content = (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/brand/jameiyah-logo.png"
        alt={APP_NAME}
        width={width}
        height={height}
        className={cn(
          'h-auto w-auto object-contain object-left',
          markOnly ? 'max-w-[2.75rem]' : 'max-w-[11rem] sm:max-w-[13rem]',
        )}
        style={{ height }}
        priority={size === 'lg'}
      />
      {markOnly ? <span className="sr-only">{APP_NAME}</span> : null}
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

/** Compact mark for loaders — same lockup, clipped to the icon. */
export function JameiyahMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/jameiyah-logo.png"
      alt=""
      width={size}
      height={size}
      className={cn('object-cover object-left drop-shadow-sm', className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
