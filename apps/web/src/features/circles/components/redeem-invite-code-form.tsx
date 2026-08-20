'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';

/** Matches server-side short invite codes (no 0/O/1/I/L). */
function isShortInviteCode(value: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6,8}$/i.test(value.trim());
}

/** Accept short codes or pasted /invitations/{token|code} links. */
export function extractInviteCredential(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isShortInviteCode(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const asUrl = trimmed.includes('://')
      ? new URL(trimmed)
      : trimmed.startsWith('/')
        ? new URL(trimmed, 'https://amanah.local')
        : null;
    if (asUrl) {
      const match = asUrl.pathname.match(/\/invitations\/([^/?#]+)/i);
      if (match?.[1]) {
        const part = decodeURIComponent(match[1]).trim();
        if (isShortInviteCode(part)) return part.toUpperCase();
        if (part.length >= 8) return part;
      }
    }
  } catch {
    // fall through
  }

  const pathMatch = trimmed.match(/\/invitations\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    const part = decodeURIComponent(pathMatch[1]).trim();
    if (isShortInviteCode(part)) return part.toUpperCase();
    if (part.length >= 8) return part;
  }

  return null;
}

export function RedeemInviteCodeForm({
  title,
  hint,
  placeholder,
  submitLabel,
  workingLabel,
  invalidLabel,
}: {
  title: string;
  hint: string;
  placeholder: string;
  submitLabel: string;
  workingLabel: string;
  invalidLabel: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const credential = extractInviteCredential(code);
        if (!credential) {
          setError(invalidLabel);
          return;
        }
        setError(null);
        startTransition(() => {
          router.push(`/invitations/${encodeURIComponent(credential)}` as Route);
        });
      }}
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="inviteCode">{submitLabel}</Label>
          <Input
            id="inviteCode"
            name="inviteCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-[0.08em]"
          />
        </div>
        <Button type="submit" className="min-h-11 sm:min-h-10" disabled={pending}>
          {pending ? workingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
