import { APP_NAME, APP_TAGLINE } from '@jamiya/shared';
import { JameiyahMark } from '@/components/jameiyah-logo';

type AppLoaderProps = {
  message?: string;
  variant?: 'fullscreen' | 'default' | 'compact' | 'inline';
  showBrand?: boolean;
};

function TrustEmblem() {
  return (
    <div className="jameiyah-loader__emblem flex items-center justify-center" aria-hidden>
      <div className="jameiyah-loader__ring-outer">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx="60"
            cy="60"
            r="52"
            className="jameiyah-loader__svg-ring jameiyah-loader__svg-ring--a"
          />
        </svg>
      </div>
      <div className="relative z-10">
        <JameiyahMark size={72} />
      </div>
    </div>
  );
}

export function AppLoader({
  message = 'Opening your circles…',
  variant = 'default',
  showBrand = true,
}: AppLoaderProps) {
  const className = [
    'jameiyah-loader',
    variant === 'fullscreen' && 'jameiyah-loader--fullscreen',
    variant === 'compact' && 'jameiyah-loader--compact',
    variant === 'inline' && 'jameiyah-loader--inline',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <div className="jameiyah-loader__mesh" aria-hidden />
      <div className="jameiyah-loader__pattern" aria-hidden />
      <div className="jameiyah-loader__glow" aria-hidden />

      <div className="jameiyah-loader__stage">
        <TrustEmblem />
        {showBrand ? (
          <>
            <p className="jameiyah-loader__title">{APP_NAME}</p>
            <p className="jameiyah-loader__tagline">{APP_TAGLINE}</p>
          </>
        ) : null}
        <p className="jameiyah-loader__message">{message}</p>
        <div className="jameiyah-loader__bar" aria-hidden>
          <div className="jameiyah-loader__bar-shine" />
        </div>
      </div>
    </div>
  );
}

/**
 * First-paint splash — plain <img> so the mark shows before Next/Image hydrates.
 * Return visits hide it with html[data-booted] before hydration.
 * Never remove this node with DOM APIs — React still owns it.
 */
export function BootSplashMarkup() {
  return (
    <div
      id="boot-splash"
      className="jameiyah-boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      suppressHydrationWarning
    >
      <div className="jameiyah-loader jameiyah-loader--fullscreen">
        <div className="jameiyah-loader__mesh" aria-hidden />
        <div className="jameiyah-loader__pattern" aria-hidden />
        <div className="jameiyah-loader__glow" aria-hidden />
        <div className="jameiyah-loader__stage">
          <div className="jameiyah-loader__emblem flex items-center justify-center" aria-hidden>
            <div className="jameiyah-loader__ring-outer">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="jameiyah-loader__svg-ring jameiyah-loader__svg-ring--a"
                />
              </svg>
            </div>
            <div className="relative z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/jameiyah-mark.png"
                alt=""
                width={72}
                height={72}
                decoding="async"
                style={{ width: 72, height: 72, objectFit: 'contain' }}
              />
            </div>
          </div>
          <p className="jameiyah-loader__title">{APP_NAME}</p>
          <p className="jameiyah-loader__tagline">{APP_TAGLINE}</p>
          <p className="jameiyah-loader__message">Starting Jameiyah…</p>
          <div className="jameiyah-loader__bar" aria-hidden>
            <div className="jameiyah-loader__bar-shine" />
          </div>
        </div>
      </div>
    </div>
  );
}
