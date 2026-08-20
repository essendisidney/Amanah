'use client';

import { useCallback, useState } from 'react';
import { Button } from '@jamiya/ui';

export function CopyInviteCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [code]);

  return (
    <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onCopy}>
      {copied ? 'Copied' : 'Copy code'}
    </Button>
  );
}
