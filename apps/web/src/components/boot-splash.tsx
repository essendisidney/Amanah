'use client';

import { useEffect } from 'react';

const MIN_SPLASH_MS = 400;
/** Always hide the overlay — never leave users stuck. */
const FAILSAFE_MS = 1400;
const BOOT_KEY = 'jameiyah-booted';

function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash || splash.getAttribute('data-out') === '1') return;

  splash.setAttribute('data-out', '1');
  splash.classList.add('amanah-boot-splash--out');
  splash.style.pointerEvents = 'none';
  document.documentElement.setAttribute('data-booted', '1');
}

/** Brief first-paint splash — cold start only; always dismisses. */
export function BootSplash() {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    try {
      if (sessionStorage.getItem(BOOT_KEY) === '1') {
        document.documentElement.setAttribute('data-booted', '1');
        return;
      }
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
      softTimer = window.setTimeout(() => {
        try {
          sessionStorage.setItem(BOOT_KEY, '1');
        } catch {
          /* private mode */
        }
        hideSplash();
      }, wait);
    };

    if (document.readyState === 'complete') {
      dismiss();
    } else {
      window.addEventListener('load', dismiss, { once: true });
      softTimer = window.setTimeout(dismiss, MIN_SPLASH_MS);
    }

    const failsafe = window.setTimeout(() => {
      try {
        sessionStorage.setItem(BOOT_KEY, '1');
      } catch {
        /* private mode */
      }
      hideSplash();
    }, FAILSAFE_MS);

    return () => {
      window.clearTimeout(softTimer);
      window.clearTimeout(failsafe);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}
