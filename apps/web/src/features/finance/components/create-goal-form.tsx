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
] as const;

export function CreateGoalForm({
  circles = [],
  defaultJamiyaId = '',
}: {
  circles?: Array<{ id: string; name: string }>;
  defaultJamiyaId?: string;
}) {
  const [title, setTitle] = useState('');

  return (
    <form
      action={createGoalFormAction}
      className="grid max-w-2xl gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6"
    >
      <div className="space-y-2 sm:col-span-2">
        <Label>Popular savings</Label>
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
        <p className="text-xs text-muted-foreground">
          Hajj, Umra, and Udhiyah — or type your own goal below. Optionally link a circle.
        </p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Goal</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hajj, Umra, school fees, wedding…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="targetAmount">Target (KES)</Label>
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
      {circles.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="jamiyaId">Link to circle (optional)</Label>
          <select
            id="jamiyaId"
            name="jamiyaId"
            defaultValue={defaultJamiyaId}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No circle — personal goal only</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" className="min-h-11 w-full sm:w-auto">
          Create goal
        </Button>
      </div>
    </form>
  );
}
