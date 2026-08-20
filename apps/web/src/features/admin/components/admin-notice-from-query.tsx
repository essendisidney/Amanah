'use client';

import { useSearchParams } from 'next/navigation';
import { CircleNoticeBanner } from '@/features/circles/components/circle-notice-banner';

export function AdminNoticeFromQuery() {
  const params = useSearchParams();
  const notice = params.get('notice') ?? undefined;
  const noticeType = params.get('noticeType') ?? undefined;
  return <CircleNoticeBanner notice={notice} noticeType={noticeType} />;
}
