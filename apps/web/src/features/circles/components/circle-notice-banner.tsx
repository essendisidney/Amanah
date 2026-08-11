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
  const success = noticeType === 'success';
  const needsWallet =
    /wallet|insufficient|top up/i.test(notice) && !success;

  return (
    <Alert variant={success ? 'success' : 'destructive'}>
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
      </AlertDescription>
    </Alert>
  );
}
