'use client';

import { useCallback, useState } from 'react';
import { Button } from '@jamiya/ui';

type InviteSharePanelProps = {
  inviteUrl: string;
  inviteCode: string;
  circleName?: string;
  /** Compact row for pending invitation lists. */
  compact?: boolean;
};

function buildShareText(
  inviteUrl: string,
  inviteCode: string,
  circleName?: string,
): string {
  const name = circleName?.trim() || 'an Amanah savings circle';
  return `You're invited to join ${name} on Amanah.\n\nOpen this link, sign in with your phone (SMS code), then Accept:\n${inviteUrl}\n\nOr in the app: Circles → Enter invite code: ${inviteCode}`;
}

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

export function InviteSharePanel({
  inviteUrl,
  inviteCode,
  circleName,
  compact = false,
}: InviteSharePanelProps) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const shareText = buildShareText(inviteUrl, inviteCode, circleName);

  const copy = useCallback(async (value: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const shareNative = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({
        title: 'Amanah invitation',
        text: shareText,
        url: inviteUrl,
      });
    } catch {
      /* user cancelled */
    }
  }, [inviteUrl, shareText]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const smsHref = `sms:?body=${encodeURIComponent(shareText)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent('Amanah circle invitation')}&body=${encodeURIComponent(shareText)}`;
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => void copy(inviteUrl, 'link')}
        >
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => void copy(inviteCode, 'code')}
        >
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Invite link</p>
        <p className="break-all text-xs text-foreground">{inviteUrl}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Invite code</p>
        <p className="font-mono text-lg font-semibold tracking-[0.2em] text-foreground">
          {inviteCode}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Share on WhatsApp. They open the link, sign in with phone OTP, then tap Accept.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copy(inviteUrl, 'link')}
        >
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copy(inviteCode, 'code')}
        >
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={smsHref}>SMS</a>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={emailHref}>Email</a>
        </Button>
        {canNativeShare ? (
          <Button type="button" size="sm" onClick={() => void shareNative()}>
            Share…
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl(inviteUrl)}
          alt="QR code for invitation link"
          width={160}
          height={160}
          className="rounded-md border border-border bg-white p-2"
        />
        <p className="max-w-xs text-xs text-muted-foreground">
          Scan this QR to open the invite link on another phone.
        </p>
      </div>
    </div>
  );
}
