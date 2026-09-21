/**
 * Optional IntaSend trust badge (static markup from IntaSend dashboard).
 * Payments do not depend on this — display-only.
 */
export function IntasendTrustBadge() {
  return (
    <div className="mt-6 flex justify-center print:hidden">
      <a
        href="https://intasend.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full flex-col items-center gap-1 rounded-lg border border-border bg-card px-4 py-3 text-center no-underline"
        aria-label="Secured by IntaSend Payments"
      >
        <span className="text-xs font-semibold text-foreground">Safe &amp; Secure Checkout</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Powered by IntaSend · M-Pesa (partner rail) · Visa · Mastercard
        </span>
      </a>
    </div>
  );
}
