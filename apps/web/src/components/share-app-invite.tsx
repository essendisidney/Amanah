'use client';

import { PageShareBar } from '@/components/page-share-bar';
import { JAMEIYAH_SHARE_BLURB } from '@/lib/whatsapp-share';

type Props = {
  /** Public origin from the server (e.g. https://jameiyah.com). */
  siteUrl: string;
  compact?: boolean;
  className?: string;
};

/**
 * One-tap invite for testers / friends: WhatsApp opens with a link to /welcome.
 */
export function ShareAppInvite({ siteUrl, compact = false, className }: Props) {
  const base = siteUrl.replace(/\/$/, '');
  const url = `${base}/welcome`;

  return (
    <PageShareBar
      compact={compact}
      className={className}
      url={url}
      title="Try Jameiyah"
      body={`${JAMEIYAH_SHARE_BLURB}\n\nOpen the link, sign in with phone SMS (or email/Google), then create or join a circle.`}
      whatsappLabel="Share on WhatsApp"
    />
  );
}
