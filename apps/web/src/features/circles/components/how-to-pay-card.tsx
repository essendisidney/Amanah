export type PaymentDetails = {
  paybill?: string;
  account?: string;
  bank?: string;
  note?: string;
};

/** The circle's own paybill / bank account, for circles that collect outside Jameiyah. */
export function HowToPayCard({ details }: { details: PaymentDetails | null | undefined }) {
  if (!details || (!details.paybill && !details.account && !details.bank && !details.note)) return null;
  return (
    <section className="jameiyah-surface space-y-2 px-5 py-4">
      <h2 className="font-semibold">How to pay</h2>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {details.paybill ? (
          <>
            <dt className="text-muted-foreground">M-Pesa paybill</dt>
            <dd className="font-mono font-medium">{details.paybill}</dd>
          </>
        ) : null}
        {details.account ? (
          <>
            <dt className="text-muted-foreground">Account number</dt>
            <dd className="font-mono font-medium">{details.account}</dd>
          </>
        ) : null}
        {details.bank ? (
          <>
            <dt className="text-muted-foreground">Bank</dt>
            <dd className="font-medium">{details.bank}</dd>
          </>
        ) : null}
      </dl>
      {details.note ? <p className="text-sm text-muted-foreground">{details.note}</p> : null}
      <p className="text-xs text-muted-foreground">
        The treasurer marks your payment from the bank statement, usually within a few days.
      </p>
    </section>
  );
}
