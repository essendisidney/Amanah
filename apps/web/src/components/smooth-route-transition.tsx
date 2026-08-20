'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppLoader } from '@/components/app-loader';

const HOLD_MS = 750;
const FADE_MS = 520;

/**
 * Soft overlay while moving between tabs/pages so loading feels continuous
 * instead of flashing a bare skeleton.
 */
export function SmoothRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState<'idle' | 'active' | 'done'>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];

    setLeaving(false);
    setVisible(true);
    setProgress('active');

    const hold = window.setTimeout(() => {
      setLeaving(true);
      setProgress('done');
      const fade = window.setTimeout(() => {
        setVisible(false);
        setLeaving(false);
        setProgress('idle');
      }, FADE_MS);
      timers.current.push(fade);
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

      {visible ? (
        <div
          className={['amanah-route-overlay', leaving && 'amanah-route-overlay--leaving']
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!visible}
        >
          <AppLoader
            message="Opening…"
            variant="inline"
            showBrand={false}
          />
        </div>
      ) : null}
    </div>
  );
}
