'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { LanguageSwitcher } from '@/i18n/language-switcher';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export type PublicNavLink = {
  href: Route;
  label: string;
  variant?: 'default' | 'ghost';
};

type PublicSiteHeaderProps = {
  locale: Locale;
  languageLabel: string;
  homeHref?: Route;
  links: PublicNavLink[];
  cta?: { href: Route; label: string };
  className?: string;
};

export function PublicSiteHeader({
  locale,
  languageLabel,
  homeHref = '/' as Route,
  links,
  cta,
  className,
}: PublicSiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className={cn('relative z-30', className)}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={homeHref}
          className="min-w-0 shrink font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-primary sm:text-2xl"
        >
          {APP_NAME}
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <LanguageSwitcher locale={locale} label={languageLabel} />

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Site"
          >
            {links.map((item) => (
              <Button key={`${item.href}-${item.label}`} variant={item.variant ?? 'ghost'} size="sm" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            {cta ? (
              <Button size="sm" asChild>
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            ) : null}
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="public-mobile-menu"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100%,18rem)] rounded-xl border border-border bg-card p-2 shadow-lg md:hidden"
            aria-label="Mobile site menu"
          >
            <ul className="flex flex-col gap-1">
              {links.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {cta ? (
                <li className="pt-1">
                  <Button className="min-h-11 w-full" asChild>
                    <Link href={cta.href} onClick={() => setMenuOpen(false)}>
                      {cta.label}
                    </Link>
                  </Button>
                </li>
              ) : null}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}
