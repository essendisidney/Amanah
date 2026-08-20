'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'amanah-theme';
const THEME_EVENT = 'amanah-theme-change';

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'dark' || value === 'light') return value;
  } catch {
    // ignore
  }
  return null;
}

export function resolveTheme(): ThemeMode {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: mode }));
}

export function ThemeToggle({
  className,
  variant = 'icon',
}: {
  className?: string;
  /** `icon` for header; `segmented` for profile settings */
  variant?: 'icon' | 'segmented';
}) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = resolveTheme();
    setMode(initial);
    applyTheme(initial);
    setReady(true);

    const onTheme = (event: Event) => {
      const detail = (event as CustomEvent<ThemeMode>).detail;
      if (detail === 'light' || detail === 'dark') setMode(detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        setMode(event.newValue);
        applyTheme(event.newValue);
      }
    };
    window.addEventListener(THEME_EVENT, onTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onTheme);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function setTheme(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
  }

  function toggle() {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-flex rounded-xl border border-border bg-muted/60 p-1',
          className,
        )}
        role="group"
        aria-label="Appearance"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
            ready && mode === 'light'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={mode === 'light'}
        >
          <Sun className="h-4 w-4" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
            ready && mode === 'dark'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={mode === 'dark'}
        >
          <Moon className="h-4 w-4" />
          Dark
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {!ready ? (
        <Sun className="h-5 w-5 opacity-40" />
      ) : mode === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
