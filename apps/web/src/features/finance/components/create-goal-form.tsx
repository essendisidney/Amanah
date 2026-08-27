'use client';

import { useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';
import { createGoalFormAction } from '../actions';

const PERIODS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
] as const;

const FAITH_GOALS = [
  { value: 'Hajj', blurb: 'Save for the pilgrimage' },
  { value: 'Umra', blurb: 'Plan your Umrah journey' },
  { value: 'Udhiyah', blurb: 'Set aside for Qurbani' },
  { value: 'School fees', blurb: 'Often a circle challenge' },
] as const;

type Mode = 'personal' | 'circle';

export function CreateGoalForm({
  circles = [],
  defaultJamiyaId = '',
}: {
  circles?: Array<{ id: string; name: string }>;
  defaultJamiyaId?: string;
}) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>(defaultJamiyaId ? 'circle' : 'personal');
  const [jamiyaId, setJamiyaId] = useState(defaultJamiyaId);

  return (
    <form action={createGoalFormAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Who is saving?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMode('personal');
              setJamiyaId('');
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mode === 'personal'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <p className="text-sm font-semibold text-foreground">Just me</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Personal goal — only you track how much you have set aside.
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('circle');
              if (!jamiyaId && circles[0]) setJamiyaId(circles[0].id);
            }}
            disabled={circles.length === 0}
            className={`rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === 'circle'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <p className="text-sm font-semibold text-foreground">Whole circle</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared challenge — each member can save a different amount; officers record deposits.
            </p>
          </button>
        </div>
        {circles.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Join or create a circle first to start a whole-circle goal.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Popular goals</Label>
        <div className="flex flex-wrap gap-2">
          {FAITH_GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setTitle(g.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                title === g.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {g.value}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Goal name</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hajj, school fees, wedding…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetAmount">
          {mode === 'circle' ? 'Circle target (KES)' : 'Your target (KES)'}
        </Label>
        <Input
          id="targetAmount"
          name="targetAmount"
          type="number"
          inputMode="decimal"
          min="1"
          required
          className="h-11 text-base sm:h-10 sm:text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="durationMonths">Period</Label>
        <select
          id="durationMonths"
          name="durationMonths"
          required
          defaultValue="12"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {mode === 'circle' && circles.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="jamiyaId">Which circle?</Label>
          <select
            id="jamiyaId"
            name="jamiyaId"
            required
            value={jamiyaId}
            onChange={(e) => setJamiyaId(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Choose a circle…
            </option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            After creating, open the goal on the circle page to record how much each member saved.
          </p>
        </div>
      ) : (
        <input type="hidden" name="jamiyaId" value="" />
      )}

      <div className="sm:col-span-2">
        <Button type="submit" className="min-h-11 w-full rounded-full sm:w-auto">
          {mode === 'circle' ? 'Create circle goal' : 'Create personal goal'}
        </Button>
      </div>
    </form>
  );
}
