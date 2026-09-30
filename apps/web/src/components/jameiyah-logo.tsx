import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { APP_NAME } from '@jamiya/shared';
import { cn } from '@/lib/utils';

type JameiyahLogoProps = {
  href?: Route | string | null;
  className?: string;
  /** @deprecated Mark-only is the default; kept for call-site compatibility. */
  markOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Kept for call-site compatibility. */
  tone?: 'brand' | 'ink';
};

const SIZE_PX = { sm: 28, md: 36, lg: 48 } as const;

/**
 * Jameiyah identity — stylised J mark (green + gold).
 */
export function JameiyahLogo({
  href = '/dashboard' as Route,
  className,
  size = 'md',
}: JameiyahLogoProps) {
  const px = SIZE_PX[size];

  const content = (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <Image
        src="/brand/jameiyah-mark.png"
        alt={APP_NAME}
        width={px}
        height={px}
        className="object-contain"
        style={{ width: px, height: px }}
        priority={size === 'lg'}
      />
    </span>
  );

  if (href == null) return content;

  return (
    <Link
      href={href as Route}
      className="inline-flex shrink-0 transition-opacity hover:opacity-90 active:opacity-80"
      aria-label={APP_NAME}
    >
      {content}
    </Link>
  );
}

/** Compact mark for loaders / splash. */
export function JameiyahMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/jameiyah-mark.png"
      alt=""
      width={size}
      height={size}
      className={cn('object-contain drop-shadow-sm', className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
