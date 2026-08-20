import { APP_NAME, APP_TAGLINE } from '@jamiya/shared';

type AppLoaderProps = {
  message?: string;
  variant?: 'fullscreen' | 'default' | 'compact';
  showBrand?: boolean;
};

function TrustEmblem() {
  return (
    <div className="amanah-loader__emblem" aria-hidden>
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
      <div className="amanah-loader__ring-inner">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx="60"
            cy="60"
            r="38"
            className="amanah-loader__svg-ring amanah-loader__svg-ring--b"
          />
          <circle
            cx="60"
            cy="60"
            r="28"
            className="amanah-loader__svg-ring amanah-loader__svg-ring--c"
          />
        </svg>
      </div>
      <div className="amanah-loader__orbit">
        <span className="amanah-loader__orbit-dot amanah-loader__orbit-dot--1" />
        <span className="amanah-loader__orbit-dot amanah-loader__orbit-dot--2" />
        <span className="amanah-loader__orbit-dot amanah-loader__orbit-dot--3" />
      </div>
      <div className="amanah-loader__core">
        <span className="amanah-loader__core-mark">A</span>
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

/** First-paint splash — removed by BootSplash after hydrate. */
export function BootSplashMarkup() {
  return (
    <div id="boot-splash" className="amanah-boot-splash" aria-hidden>
      <AppLoader message="Starting Amanah…" variant="fullscreen" />
    </div>
  );
}
