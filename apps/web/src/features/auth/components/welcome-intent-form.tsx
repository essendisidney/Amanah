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
    hint: 'Start or join a trusted family circle',
  },
  {
    id: 'join',
    title: 'Join a savings circle',
    hint: 'I already have an invite code',
  },
  {
    id: 'build',
    title: 'Build my savings',
    hint: 'Personal goals and wallet first',
  },
  {
    id: 'manage',
    title: 'Manage my money',
    hint: 'Send, receive, and track activity',
  },
  {
    id: 'business',
    title: 'Create a business circle',
    hint: 'Stage, chama, or workplace group',
  },
] as const;

export function WelcomeIntentForm() {
  const [intent, setIntent] = useState<(typeof INTENTS)[number]['id']>('family');
  const next =
    intent === 'join'
      ? ('/phone?next=/circles' as Route)
      : intent === 'build'
        ? ('/phone?next=/finance/goals' as Route)
        : intent === 'manage'
          ? ('/phone?next=/wallet' as Route)
          : intent === 'business'
            ? ('/phone?next=/circles/new' as Route)
            : ('/phone?next=/dashboard' as Route);

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {INTENTS.map((item) => {
          const active = intent === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setIntent(item.id)}
                className={cn(
                  'amanah-surface flex w-full flex-col items-start gap-0.5 px-4 py-3.5 text-left transition-colors',
                  active ? 'border-primary/40 bg-secondary/60' : 'hover:border-primary/20',
                )}
              >
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button asChild className="min-h-12 w-full">
        <Link href={next}>Continue</Link>
      </Button>
    </div>
  );
}
