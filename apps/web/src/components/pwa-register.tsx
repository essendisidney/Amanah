'use client';

import { useEffect } from 'react';

/** Registers the installability service worker once on the client. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AMANAH_SW_UPDATED') {
        // New shell is active — reload once so theme/boot scripts aren't stale.
        const key = 'amanah-sw-reload-v6';
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            window.location.reload();
          }
        } catch {
          window.location.reload();
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          void reg.update();
        })
        .catch(() => {
          /* ignore offline / unsupported */
        });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
