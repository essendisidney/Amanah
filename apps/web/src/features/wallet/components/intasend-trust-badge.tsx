/**
 * Optional IntaSend trust badge (static markup from IntaSend dashboard).
 * Payments do not depend on this — display-only.
 */
export function IntasendTrustBadge() {
  return (
    <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground print:hidden">
      Secured by IntaSend
    </p>
  );
}
