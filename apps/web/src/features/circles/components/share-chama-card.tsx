'use client';

import { useCallback, useState } from 'react';
import { Button } from '@jamiya/ui';
import { whatsappShareHref } from '@/lib/whatsapp-share';
import { useCanNativeShare } from '@/lib/use-can-native-share';

function shareText(circleName: string, inviteUrl: string) {
  return `Join ${circleName} on Jameiyah.\n\n${inviteUrl}`;
}

/** One standing link a member can send to anyone. */
export function ShareChamaCard({
  circleName,
  inviteUrl,
  full = false,
}: {
  circleName: string;
  inviteUrl: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = shareText(circleName, inviteUrl);
  const canNativeShare = useCanNativeShare();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inviteUrl]);

  const shareNative = useCallback(async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({ title: circleName, text, url: inviteUrl });
    } catch {
      /* cancelled */
    }
  }, [canNativeShare, circleName, inviteUrl, text]);

  return (
    <section className="jameiyah-surface space-y-3 px-4 py-4 sm:px-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Share this chama
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {full
            ? 'This group is full. A leader can raise the member limit, then share again.'
            : 'Send the link on WhatsApp. They sign in and tap Join. The same link keeps working.'}
        </p>
      </div>
      {full ? null : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11 w-full sm:flex-1">
            <a href={whatsappShareHref(text)} target="_blank" rel="noopener noreferrer">
              Share on WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => void copy()}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
          {canNativeShare ? (
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => void shareNative()}>
              Share
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
