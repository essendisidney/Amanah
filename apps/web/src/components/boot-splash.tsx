'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 420;
const FADE_MS = 380;
const FAILSAFE_MS = 2800;

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash || splash.classList.contains('amanah-boot-splash--out')) return;
  splash.classList.add('amanah-boot-splash--out');
  window.setTimeout(() => {
    splash.remove();
  }, FADE_MS);
}

/** Brief first-paint splash — keep short so route skeletons don’t feel like a second load. */
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
