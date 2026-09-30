'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const KEY = 'jameiyah-hide-balance';
const ATTR = 'data-hide-balance';

/** Wraps a balance so it is masked while balances are hidden. */
export function PrivateAmount({ children }: { children: React.ReactNode }) {
  return (
    <span className="jm-private">
      <span className="jm-private-v">{children}</span>
    </span>
  );
}

/** Eye button that hides or shows balances on this device (remembered). */
export function BalanceToggle({
  showLabel,
  hideLabel,
  className = '',
}: {
  showLabel: string;
  hideLabel: string;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(document.documentElement.hasAttribute(ATTR));
  }, []);

  function toggle() {
    const next = !document.documentElement.hasAttribute(ATTR);
    if (next) document.documentElement.setAttribute(ATTR, '');
    else document.documentElement.removeAttribute(ATTR);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable: still toggles for this page */
    }
    setHidden(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? showLabel : hideLabel}
      title={hidden ? showLabel : hideLabel}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {/* CSS picks the icon before hydration so there is no flash. */}
      <Eye className="jm-private-show h-5 w-5" aria-hidden />
      <EyeOff className="jm-private-hide h-5 w-5" aria-hidden />
    </button>
  );
}
