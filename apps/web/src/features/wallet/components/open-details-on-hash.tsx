'use client';

import { useEffect, useRef } from 'react';

/** Opens a &lt;details&gt; when the URL hash matches its id (one tap from shortcuts). */
export function OpenDetailsOnHash({ id }: { id: string }) {
  const ref = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const openIfHash = () => {
      const el = ref.current ?? document.getElementById(id);
      if (!(el instanceof HTMLDetailsElement)) return;
      if (window.location.hash === `#${id}`) {
        el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    openIfHash();
    window.addEventListener('hashchange', openIfHash);
    return () => window.removeEventListener('hashchange', openIfHash);
  }, [id]);

  return (
    <span
      ref={(node) => {
        ref.current = node?.closest('details') ?? null;
      }}
      className="hidden"
      aria-hidden
    />
  );
}
