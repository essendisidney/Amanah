import { APP_NAME, APP_TAGLINE } from '@jamiya/shared';
import { AmanahMark } from '@/components/amanah-logo';

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
        <AmanahMark size={72} />
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

/** First-paint splash — removed by BootSplash after a smooth hold. */
export function BootSplashMarkup() {
  return (
    <div id="boot-splash" className="amanah-boot-splash" aria-hidden>
      <AppLoader message="Starting Amanah…" variant="fullscreen" />
    </div>
  );
}
