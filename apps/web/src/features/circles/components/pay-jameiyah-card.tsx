import { formatCurrency } from '@jamiya/shared';

export type JameiyahPayment = {
  reference: string;
  held: number;
  details: {
    account_name?: string;
    bank?: string;
    branch?: string;
    account?: string;
    paybill?: string;
    mpesa_account?: string;
  };
};

/** How a circle pays Jameiyah for its plan: M-Pesa paybill or bank transfer, quoting its reference. */
export function PayJameiyahCard({ pay }: { pay: JameiyahPayment }) {
  const d = pay.details;
  const mpesaAccount = d.mpesa_account ? d.mpesa_account.replaceAll('{ref}', pay.reference) : null;
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
      <p className="font-medium">Pay by M-Pesa or bank</p>
      <p className="text-muted-foreground">
        Your circle&apos;s payment reference is <span className="font-mono font-semibold text-foreground">{pay.reference}</span>.
        Pay the price of the plan and period you want (shown below), then we switch it on within one working day.
      </p>
      {d.paybill && mpesaAccount ? (
        <p>
          M-Pesa: Lipa na M-Pesa → Pay Bill · Business no. <span className="font-mono font-semibold">{d.paybill}</span> ·
          Account no. <span className="font-mono font-semibold">{mpesaAccount}</span>
        </p>
      ) : null}
      {d.account ? (
        <p>
          Bank transfer: {d.account_name ?? 'Jameiyah'} · {d.bank}
          {d.branch ? `, ${d.branch}` : ''} · Account <span className="font-mono font-semibold">{d.account}</span> ·
          Reference <span className="font-mono font-semibold">{pay.reference}</span>
        </p>
      ) : null}
      {pay.held > 0 ? (
        <p className="text-xs text-muted-foreground">
          {formatCurrency(pay.held, 'KES')} received so far; pay the rest of the plan price to switch it on.
        </p>
      ) : null}
    </div>
  );
}
