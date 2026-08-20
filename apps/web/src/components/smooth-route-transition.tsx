'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const HOLD_MS = 280;
const DONE_MS = 220;

/**
 * Thin top progress only — no full-page loader overlay.
 * Route `loading.tsx` skeletons handle content; stacking AppLoader on top felt like a double load.
 */
export function SmoothRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [progress, setProgress] = useState<'idle' | 'active' | 'done'>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];

    setProgress('active');

    const hold = window.setTimeout(() => {
      setProgress('done');
      const clear = window.setTimeout(() => setProgress('idle'), DONE_MS);
      timers.current.push(clear);
    }, HOLD_MS);

    timers.current.push(hold);

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, [pathname]);

  return (
    <div className="relative min-h-[40vh]">
      <div className="amanah-top-progress" aria-hidden>
        <div
          className={[
            'amanah-top-progress__bar',
            progress === 'active' && 'amanah-top-progress__bar--active',
            progress === 'done' && 'amanah-top-progress__bar--done',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
      {children}
    </div>
  );
}
