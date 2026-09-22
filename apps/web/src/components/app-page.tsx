import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AppPageProps = {
  children: ReactNode;
  className?: string;
  /** Narrow content (forms, statements). Default uses full shell width. */
  width?: 'default' | 'narrow' | 'medium';
};

const widthClasses: Record<NonNullable<AppPageProps['width']>, string> = {
  default: '',
  medium: 'mx-auto max-w-4xl',
  narrow: 'mx-auto max-w-3xl',
};

export function AppPage({ children, className, width = 'default' }: AppPageProps) {
  return (
    <div className={cn('relative space-y-8', widthClasses[width], className)}>{children}</div>
  );
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            'font-[family-name:var(--font-display)] font-semibold tracking-tight text-foreground',
            eyebrow ? 'mt-1 text-3xl sm:text-4xl' : 'text-3xl sm:text-4xl',
          )}
        >
          {title}
        </h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

type PageSectionProps = {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
};

export function PageSection({
  id,
  title,
  description,
  action,
  children,
  padded = true,
  className,
}: PageSectionProps) {
  return (
    <section id={id} className={cn('scroll-mt-24 space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={padded ? 'amanah-surface px-4 py-4 sm:px-5 sm:py-5' : undefined}>
        {children}
      </div>
    </section>
  );
}

/** Glass card for standalone blocks (lists, forms). */
export function PageCard({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('amanah-surface px-4 py-4 sm:px-5 sm:py-5', className)}>
      {children}
    </div>
  );
}
