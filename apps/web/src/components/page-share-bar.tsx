'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';
import {
  composeWhatsAppMessage,
  JAMEIYAH_SHARE_BLURB,
  whatsappShareHref,
} from '@/lib/whatsapp-share';

type Props = {
  /** Absolute or path URL to share. Defaults to current page when mounted. */
  url?: string;
  title?: string;
  body?: string;
  /** Compact icon-row for headers. */
  compact?: boolean;
  className?: string;
  whatsappLabel?: string;
  copyLabel?: string;
  copiedLabel?: string;
};

/**
 * App-wide share strip: WhatsApp first, then copy link.
 * Use on public pages, receipts, referrals, and in-app surfaces.
 */
export function PageShareBar({
  url: urlProp,
  title,
  body = JAMEIYAH_SHARE_BLURB,
  compact = false,
  className,
  whatsappLabel = 'WhatsApp',
  copyLabel = 'Copy link',
  copiedLabel = 'Link copied',
}: Props) {
  const [pageUrl, setPageUrl] = useState(urlProp ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (urlProp) {
      setPageUrl(urlProp);
      return;
    }
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.href.split('#')[0] ?? window.location.href);
    }
  }, [urlProp]);

  const shareText = useMemo(
    () =>
      composeWhatsAppMessage({
        title,
        body,
        url: pageUrl || undefined,
      }),
    [title, body, pageUrl],
  );

  const copy = useCallback(async () => {
    const value = pageUrl || shareText;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [pageUrl, shareText]);

  const shareNative = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share || !pageUrl) return;
    try {
      await navigator.share({
        title: title ?? 'Jameiyah',
        text: body,
        url: pageUrl,
      });
    } catch {
      /* cancelled */
    }
  }, [body, pageUrl, title]);

  const canNative =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        compact ? '' : 'rounded-lg border border-border/70 bg-muted/30 px-3 py-3',
        className,
      )}
      role="group"
      aria-label="Share"
    >
      {!compact ? (
        <p className="mr-auto w-full text-xs text-muted-foreground sm:w-auto">
          Share via WhatsApp
        </p>
      ) : null}
      <Button type="button" variant="default" className="min-h-11" asChild>
        <a href={whatsappShareHref(shareText)} target="_blank" rel="noopener noreferrer">
          {whatsappLabel}
        </a>
      </Button>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void copy()}>
        {copied ? copiedLabel : copyLabel}
      </Button>
      {canNative ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void shareNative()}>
          Share…
        </Button>
      ) : null}
    </div>
  );
}
