'use client';

import { useCallback, useState } from 'react';
import { Button } from '@jamiya/ui';

type InviteSharePanelProps = {
  inviteUrl: string;
  inviteCode: string;
  circleName?: string;
};

function buildShareText(
  inviteUrl: string,
  inviteCode: string,
  circleName?: string,
): string {
  const name = circleName?.trim() || 'an Amanah savings circle';
  return `You're invited to join ${name} on Amanah.\n\n1) Open Amanah and sign in with your phone (SMS code)\n2) Enter invite code: ${inviteCode}\n\nOr open this link after signing in:\n${inviteUrl}`;
}

function qrImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

export function InviteSharePanel({
  inviteUrl,
  inviteCode,
  circleName,
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
          Easy to share on WhatsApp. No email needed — sign in with phone OTP, then paste
          this code in Amanah.
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
