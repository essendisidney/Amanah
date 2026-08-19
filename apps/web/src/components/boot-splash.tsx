'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 750;

/** Fades out the static boot splash once the app has hydrated. */
export function BootSplash() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    const shownAt = Date.now();

    const dismiss = () => {
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - shownAt));
      window.setTimeout(() => {
        splash.classList.add('amanah-boot-splash--out');
        window.setTimeout(() => splash.remove(), 560);
      }, wait);
    };

    if (document.readyState === 'complete') {
      dismiss();
      return;
    }

    window.addEventListener('load', dismiss, { once: true });
    return () => window.removeEventListener('load', dismiss);
  }, []);

  return null;
}
