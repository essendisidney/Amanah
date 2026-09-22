import Link from 'next/link';
import type { Route } from 'next';
import { Alert, AlertDescription } from '@jamiya/ui';

export function CircleNoticeBanner({
  notice,
  noticeType,
}: {
  notice?: string;
  noticeType?: string;
}) {
  if (!notice?.trim()) return null;
  const error = noticeType === 'error' || noticeType === 'destructive';
  const info = noticeType === 'info';
  const needsWallet =
    /wallet|insufficient|top up/i.test(notice) && error;

  return (
    <Alert variant={error ? 'destructive' : info ? 'default' : 'success'}>
      <AlertDescription>
        {notice}
        {needsWallet ? (
          <>
            {' '}
            <Link href={'/wallet' as Route} className="font-medium underline">
              Open wallet
            </Link>
          </>
        ) : null}
        {info && /M-Pesa|PIN|prompt|Approve/i.test(notice) ? (
          <>
            {' '}
            <a href="#stk-waiting" className="font-medium underline">
              Check status
            </a>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
