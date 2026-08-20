'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 1600;
const FADE_MS = 900;
const FAILSAFE_MS = 4500;

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash || splash.classList.contains('amanah-boot-splash--out')) return;
  splash.classList.add('amanah-boot-splash--out');
  window.setTimeout(() => {
    splash.remove();
  }, FADE_MS);
}

/** Holds the branded splash long enough to feel smooth, then fades out. */
export function BootSplash() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    const shownAt = Date.now();
    let timeoutId = 0;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - shownAt));
      timeoutId = window.setTimeout(hideSplash, wait);
    };

    if (document.readyState === 'complete') {
      dismiss();
    } else {
      window.addEventListener('load', dismiss, { once: true });
      // Still show a full beat even if load fires early.
      timeoutId = window.setTimeout(dismiss, MIN_SPLASH_MS);
    }

    const failsafe = window.setTimeout(hideSplash, FAILSAFE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(failsafe);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}
