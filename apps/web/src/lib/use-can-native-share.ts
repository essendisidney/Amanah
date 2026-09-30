'use client';

import { useEffect, useState } from 'react';

/**
 * True when the browser supports the native share sheet.
 * Starts false on the server and on first client render, then updates after mount,
 * so server and client HTML match (avoids React hydration error #418).
 */
export function useCanNativeShare(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    setCan(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  return can;
}
