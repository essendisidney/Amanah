'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { isShortInviteCode } from '../lib/invitation-token';

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
        const trimmed = code.trim().toUpperCase();
        if (!isShortInviteCode(trimmed)) {
          setError(invalidLabel);
          return;
        }
        setError(null);
        startTransition(() => {
          router.push(`/invitations/${encodeURIComponent(trimmed)}` as Route);
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
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono tracking-[0.18em]"
            maxLength={8}
          />
        </div>
        <Button type="submit" className="min-h-11 sm:min-h-10" disabled={pending}>
          {pending ? workingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
