'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';

const INTENTS = [
  {
    id: 'family',
    title: 'Save with my family',
    next: '/circles/new?intent=family',
  },
  {
    id: 'join',
    title: 'Join a savings circle',
    next: '/circles?redeem=1',
  },
  {
    id: 'build',
    title: 'Build my savings',
    next: '/finance/goals',
  },
  {
    id: 'manage',
    title: 'Manage my money',
    next: '/wallet',
  },
  {
    id: 'business',
    title: 'Create a business circle',
    next: '/circles/new?intent=business',
  },
] as const;

export function WelcomeIntentForm() {
  const [intentId, setIntentId] = useState<(typeof INTENTS)[number]['id']>('family');
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
                className={cn(
                  'amanah-surface flex w-full items-center px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors',
                  active ? 'border-primary/40 bg-secondary/60' : 'hover:border-primary/20',
                )}
              >
                {item.title}
              </button>
            </li>
          );
        })}
      </ul>
      <Button asChild className="min-h-12 w-full">
        <Link href={href}>Continue</Link>
      </Button>
    </div>
  );
}
