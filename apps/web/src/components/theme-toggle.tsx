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

/** Local daylight window — light from 6:00 through 17:59, dark otherwise. */
const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 18;

export function themeFromTimeOfDay(date = new Date()): ThemeAppearance {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? 'light' : 'dark';
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
  if (preference === 'auto') return themeFromTimeOfDay();
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

function msUntilNextDaypartBoundary(date = new Date()) {
  const next = new Date(date);
  const hour = date.getHours();
  if (hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR) {
    next.setHours(NIGHT_START_HOUR, 0, 0, 0);
  } else if (hour >= NIGHT_START_HOUR) {
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_START_HOUR, 0, 0, 0);
  } else {
    next.setHours(DAY_START_HOUR, 0, 0, 0);
  }
  return Math.max(1_000, next.getTime() - date.getTime());
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
  const [preference, setPreference] = useState<ThemePreference>('auto');
  const [appearance, setAppearance] = useState<ThemeAppearance>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getStoredPreference() ?? 'auto';
    setPreference(initial);
    setAppearance(applyPreference(initial));
    setReady(true);

    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleAutoRefresh = (pref: ThemePreference) => {
      if (timer) clearTimeout(timer);
      if (pref !== 'auto') return;
      timer = setTimeout(() => {
        const nextAppearance = applyPreference('auto');
        setAppearance(nextAppearance);
        scheduleAutoRefresh('auto');
      }, msUntilNextDaypartBoundary());
    };

    scheduleAutoRefresh(initial);

    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<ThemeDetail>).detail;
      if (!detail) return;
      if (detail.preference === 'light' || detail.preference === 'dark' || detail.preference === 'auto') {
        setPreference(detail.preference);
        scheduleAutoRefresh(detail.preference);
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
        scheduleAutoRefresh(value);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const pref = getStoredPreference() ?? 'auto';
      if (pref === 'auto') {
        setAppearance(applyPreference('auto'));
        scheduleAutoRefresh('auto');
      }
    };

    window.addEventListener(THEME_EVENT, onTheme);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(THEME_EVENT, onTheme);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  function setTheme(next: ThemePreference) {
    setPreference(next);
    setAppearance(applyPreference(next));
  }

  function cycleTheme() {
    const order: ThemePreference[] = ['light', 'auto', 'dark'];
    const idx = order.indexOf(preference);
    setTheme(order[(idx + 1) % order.length] ?? 'auto');
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
      ? `Auto · ${appearance === 'dark' ? 'night' : 'day'} (tap to change)`
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
