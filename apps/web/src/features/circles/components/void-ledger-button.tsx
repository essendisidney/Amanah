import { Button } from '@jamiya/ui';
import { voidLedgerLineAction } from '../actions/books-actions';

type VoidKind = 'book_entry' | 'share_lot' | 'loan_event';

/** Compact officer control to remove a mistaken ledger line. */
export function VoidLedgerButton({
  slug,
  memberId,
  kind,
  id,
  label = 'Void',
}: {
  slug: string;
  memberId: string;
  kind: VoidKind;
  id: string;
  label?: string;
}) {
  return (
    <form action={voidLedgerLineAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {label}
      </Button>
    </form>
  );
}
