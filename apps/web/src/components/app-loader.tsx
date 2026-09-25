import { APP_NAME, APP_TAGLINE } from '@jamiya/shared';
import { JameiyahMark } from '@/components/amanah-logo';

type AppLoaderProps = {
  message?: string;
  variant?: 'fullscreen' | 'default' | 'compact' | 'inline';
  showBrand?: boolean;
};

function TrustEmblem() {
  return (
    <div className="amanah-loader__emblem flex items-center justify-center" aria-hidden>
      <div className="amanah-loader__ring-outer">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx="60"
            cy="60"
            r="52"
            className="amanah-loader__svg-ring amanah-loader__svg-ring--a"
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
    'amanah-loader',
    variant === 'fullscreen' && 'amanah-loader--fullscreen',
    variant === 'compact' && 'amanah-loader--compact',
    variant === 'inline' && 'amanah-loader--inline',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <div className="amanah-loader__mesh" aria-hidden />
      <div className="amanah-loader__pattern" aria-hidden />
      <div className="amanah-loader__glow" aria-hidden />

      <div className="amanah-loader__stage">
        <TrustEmblem />
        {showBrand ? (
          <>
            <p className="amanah-loader__title">{APP_NAME}</p>
            <p className="amanah-loader__tagline">{APP_TAGLINE}</p>
          </>
        ) : null}
        <p className="amanah-loader__message">{message}</p>
        <div className="amanah-loader__bar" aria-hidden>
          <div className="amanah-loader__bar-shine" />
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
      className="amanah-boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      suppressHydrationWarning
    >
      <div className="amanah-loader amanah-loader--fullscreen">
        <div className="amanah-loader__mesh" aria-hidden />
        <div className="amanah-loader__pattern" aria-hidden />
        <div className="amanah-loader__glow" aria-hidden />
        <div className="amanah-loader__stage">
          <div className="amanah-loader__emblem flex items-center justify-center" aria-hidden>
            <div className="amanah-loader__ring-outer">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="amanah-loader__svg-ring amanah-loader__svg-ring--a"
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
          <p className="amanah-loader__title">{APP_NAME}</p>
          <p className="amanah-loader__tagline">{APP_TAGLINE}</p>
          <p className="amanah-loader__message">Starting Jameiyah…</p>
          <div className="amanah-loader__bar" aria-hidden>
            <div className="amanah-loader__bar-shine" />
          </div>
        </div>
      </div>
    </div>
  );
}
