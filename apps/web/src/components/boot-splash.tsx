'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 400;

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('amanah-boot-splash--out');
  window.setTimeout(() => {
    splash.remove();
  }, 400);
}

/** Fades out the static boot splash once the app has hydrated. */
export function BootSplash() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    const shownAt = Date.now();
    let timeoutId = 0;

    const dismiss = () => {
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - shownAt));
      timeoutId = window.setTimeout(hideSplash, wait);
    };

    dismiss();
    const failsafe = window.setTimeout(hideSplash, 2500);
    window.addEventListener('load', dismiss, { once: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(failsafe);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}
