'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';

const INTENTS = [
  { id: 'family', next: '/circles/new?intent=family' },
  { id: 'join', next: '/circles?redeem=1' },
  { id: 'build', next: '/finance/goals' },
  { id: 'manage', next: '/wallet' },
  { id: 'business', next: '/circles/new?intent=business' },
] as const;

type IntentId = (typeof INTENTS)[number]['id'];

export type WelcomeIntentLabels = Record<IntentId, string> & { continue: string };

const DEFAULT_LABELS: WelcomeIntentLabels = {
  family: 'Save with my family',
  join: 'Join a savings circle',
  build: 'Build my savings',
  manage: 'Manage my money',
  business: 'Create a business circle',
  continue: 'Continue',
};

export function WelcomeIntentForm({ labels = DEFAULT_LABELS }: { labels?: WelcomeIntentLabels }) {
  const [intentId, setIntentId] = useState<IntentId>('family');
  const intent = INTENTS.find((item) => item.id === intentId) ?? INTENTS[0];
  const href = `/login?next=${encodeURIComponent(intent.next)}` as Route;

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {INTENTS.map((item) => {
          const active = intentId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setIntentId(item.id)}
                aria-pressed={active}
                className={cn(
                  'jameiyah-surface flex w-full items-center px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors',
                  active ? 'border-primary/40 bg-secondary/60' : 'hover:border-primary/20',
                )}
              >
                {labels[item.id]}
              </button>
            </li>
          );
        })}
      </ul>
      <Button asChild className="min-h-12 w-full">
        <Link href={href}>{labels.continue}</Link>
      </Button>
    </div>
  );
}
