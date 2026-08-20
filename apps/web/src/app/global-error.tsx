'use client';

import { useEffect, useRef } from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retried = useRef(false);

  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    reset();
  }, [reset]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#fbfcfa',
          color: '#1a1f1c',
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.16em', color: '#c9a227' }}>
            AMANAH
          </p>
          <h1 style={{ margin: '12px 0', fontSize: 24 }}>Could not open the app</h1>
          <p style={{ margin: '0 0 20px', color: '#5c6b62', lineHeight: 1.5 }}>
            Retrying now. If this stays, close the tab and open amanah-liart.vercel.app again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: 0,
              borderRadius: 8,
              background: '#047857',
              color: '#f7faf8',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
