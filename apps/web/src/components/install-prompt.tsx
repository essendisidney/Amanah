'use client';

import { useEffect, useState } from 'react';
import { Button } from '@jamiya/ui';

const DISMISS_KEY = 'amanah-install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
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

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'native' | 'ios' | null>(null);
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
    return () => window.removeEventListener('beforeinstallprompt', onBip);
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
      ? 'Share → Add to Home Screen for one-tap access to your circles and wallet.'
      : 'Install Amanah for quick access on your phone or desktop.';

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-4 md:px-4"
      role="dialog"
      aria-labelledby="amanah-install-title"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-border/80 bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            id="amanah-install-title"
            className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground"
          >
            Add Amanah to your device
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'native' && deferred ? (
            <Button type="button" size="sm" onClick={install} disabled={busy}>
              {busy ? 'Opening…' : 'Install'}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
