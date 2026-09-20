'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 400;
const FADE_MS = 480;
/** Always clear the overlay — never leave users stuck. */
const FAILSAFE_MS = 1400;
const HARD_REMOVE_MS = 2000;
const BOOT_KEY = 'jameiyah-booted';

function hideSplash(immediate = false) {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  if (splash.getAttribute('data-out') === '1' && !immediate) return;

  splash.setAttribute('data-out', '1');
  splash.classList.add('amanah-boot-splash--out');
  splash.style.pointerEvents = 'none';

  const remove = () => {
    try {
      splash.remove();
    } catch {
      /* already gone */
    }
  };

  if (immediate) {
    remove();
    return;
  }

  window.setTimeout(remove, FADE_MS);
}

/** Brief first-paint splash — cold start only; always dismisses. */
export function BootSplash() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    try {
      if (sessionStorage.getItem(BOOT_KEY) === '1') {
        hideSplash(true);
        return;
      }
      sessionStorage.setItem(BOOT_KEY, '1');
    } catch {
      /* private mode */
    }

    const shownAt = Date.now();
    let softTimer = 0;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - shownAt));
      softTimer = window.setTimeout(() => hideSplash(false), wait);
    };

    if (document.readyState === 'complete') {
      dismiss();
    } else {
      window.addEventListener('load', dismiss, { once: true });
      softTimer = window.setTimeout(dismiss, MIN_SPLASH_MS);
    }

    const failsafe = window.setTimeout(() => hideSplash(false), FAILSAFE_MS);
    const hard = window.setTimeout(() => hideSplash(true), HARD_REMOVE_MS);

    return () => {
      window.clearTimeout(softTimer);
      window.clearTimeout(failsafe);
      window.clearTimeout(hard);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}
