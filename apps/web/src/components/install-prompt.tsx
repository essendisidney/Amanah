'use client';

import { useEffect, useState } from 'react';
import { Button } from '@jamiya/ui';
import type { Dictionary } from '@/i18n/dictionaries';

const DISMISS_KEY = 'amanah-install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const ANDROID_FALLBACK_MS = 3500;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallMode = 'native' | 'ios' | 'android';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Android phone/tablet UA — excludes desktop Chrome with "Request desktop site". */
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/**
 * Android Chrome often withholds `beforeinstallprompt` (engagement heuristics,
 * WebView / in-app browsers, or prior dismiss). When that happens, show manual
 * Install / Add to Home screen steps instead of staying silent.
 */
export function InstallPrompt({ labels }: { labels: Dictionary['install'] }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;

    if (isIos()) {
      const t = window.setTimeout(() => setMode('ios'), 2500);
      return () => window.clearTimeout(t);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('native');
    };
    window.addEventListener('beforeinstallprompt', onBip);

    let androidTimer: number | undefined;
    if (isAndroid()) {
      androidTimer = window.setTimeout(() => {
        setMode((current) => current ?? 'android');
      }, ANDROID_FALLBACK_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      if (androidTimer) window.clearTimeout(androidTimer);
    };
  }, []);

  function dismiss() {
    setMode(null);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!mode) return null;

  const detail =
    mode === 'ios'
      ? labels.detailIos
      : mode === 'android'
        ? labels.detailAndroid
        : labels.detailNative;

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-4 md:px-4"
      role="dialog"
      aria-labelledby="amanah-install-title"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-border/80 bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            id="amanah-install-title"
            className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground"
          >
            {labels.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'native' && deferred ? (
            <Button type="button" size="sm" onClick={install} disabled={busy}>
              {busy ? labels.opening : labels.install}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
            {labels.notNow}
          </Button>
        </div>
      </div>
    </div>
  );
}
