'use client';

import { useEffect } from 'react';

/** Scroll to invite redeem when arriving from welcome intent (`?redeem=1`). */
export function FocusRedeemInvite({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById('redeem-invite');
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [active]);

  return null;
}
