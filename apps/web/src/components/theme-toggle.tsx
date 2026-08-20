'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Sunset } from 'lucide-react';
import { cn } from '@/lib/utils';

/** User preference (what they chose). */
export type ThemePreference = 'light' | 'dark' | 'auto';
/** Resolved appearance applied to the document. */
export type ThemeAppearance = 'light' | 'dark';

const STORAGE_KEY = 'amanah-theme';
const THEME_EVENT = 'amanah-theme-change';

/** Auto follows the OS — not clock time (night Auto was forcing dark on mobile). */
export function themeFromSystem(): ThemeAppearance {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function getStoredPreference(): ThemePreference | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'dark' || value === 'light' || value === 'auto') return value;
  } catch {
    // ignore
  }
  return null;
}

export function resolveAppearance(preference: ThemePreference): ThemeAppearance {
  if (preference === 'auto') return themeFromSystem();
  return preference;
}

export function applyAppearance(appearance: ThemeAppearance) {
  const root = document.documentElement;
  if (appearance === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = appearance;

  // Keep mobile browser chrome in sync with the actual app theme
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', appearance === 'dark' ? '#0a1f1a' : '#f8fafc');
  }
}

export function applyPreference(preference: ThemePreference) {
  const appearance = resolveAppearance(preference);
  applyAppearance(appearance);
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent(THEME_EVENT, { detail: { preference, appearance } }),
  );
  return appearance;
}

type ThemeDetail = { preference: ThemePreference; appearance: ThemeAppearance };

export function ThemeToggle({
  className,
  variant = 'icon',
}: {
  className?: string;
  /** `icon` for header; `segmented` for profile settings */
  variant?: 'icon' | 'segmented';
}) {
  const [preference, setPreference] = useState<ThemePreference>('light');
  const [appearance, setAppearance] = useState<ThemeAppearance>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getStoredPreference() ?? 'light';
    setPreference(initial);
    setAppearance(applyPreference(initial));
    setReady(true);

    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<ThemeDetail>).detail;
      if (!detail) return;
      if (detail.preference === 'light' || detail.preference === 'dark' || detail.preference === 'auto') {
        setPreference(detail.preference);
      }
      if (detail.appearance === 'light' || detail.appearance === 'dark') {
        setAppearance(detail.appearance);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const value = event.newValue;
      if (value === 'light' || value === 'dark' || value === 'auto') {
        setPreference(value);
        setAppearance(applyPreference(value));
      }
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      const pref = getStoredPreference() ?? 'light';
      if (pref === 'auto') {
        setAppearance(applyPreference('auto'));
      }
    };

    window.addEventListener(THEME_EVENT, onTheme);
    window.addEventListener('storage', onStorage);
    mq.addEventListener?.('change', onSystem);
    // Safari < 14
    mq.addListener?.(onSystem);

    return () => {
      window.removeEventListener(THEME_EVENT, onTheme);
      window.removeEventListener('storage', onStorage);
      mq.removeEventListener?.('change', onSystem);
      mq.removeListener?.(onSystem);
    };
  }, []);

  function setTheme(next: ThemePreference) {
    setPreference(next);
    setAppearance(applyPreference(next));
  }

  function cycleTheme() {
    const order: ThemePreference[] = ['light', 'auto', 'dark'];
    const idx = order.indexOf(preference);
    setTheme(order[(idx + 1) % order.length] ?? 'light');
  }

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-flex max-w-full rounded-xl border border-border bg-muted/60 p-1',
          className,
        )}
        role="group"
        aria-label="Appearance"
      >
        {(
          [
            { id: 'light' as const, label: 'Light', icon: Sun },
            { id: 'auto' as const, label: 'Auto', icon: Sunset },
            { id: 'dark' as const, label: 'Dark', icon: Moon },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = ready && preference === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors sm:px-3',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={preference === item.id}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  const label =
    preference === 'auto'
      ? `Auto · ${appearance === 'dark' ? 'system dark' : 'system light'} (tap to change)`
      : preference === 'dark'
        ? 'Dark mode (tap for Auto)'
        : 'Light mode (tap for Auto)';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
      aria-label={label}
      title={label}
    >
      {!ready ? (
        <Sun className="h-5 w-5 opacity-40" />
      ) : preference === 'auto' ? (
        <Sunset className="h-5 w-5" />
      ) : appearance === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
