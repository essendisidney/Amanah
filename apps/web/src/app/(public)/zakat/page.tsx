'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';

const NISAB_KES = 1_100_000;

export default function ZakatPage() {
  const [cash, setCash] = useState(0);
  const [gold, setGold] = useState(0);
  const [debts, setDebts] = useState(0);
  const wealth = Math.max(0, cash + gold - debts);
  const zakat = wealth >= NISAB_KES ? wealth * 0.025 : 0;
  const sadakaHref = useMemo(() => {
    if (zakat <= 0) return '/sadaka' as Route;
    return `/sadaka?amount=${Math.round(zakat)}` as Route;
  }, [zakat]);

  return (
    <main className="amanah-geo min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
          <Button asChild variant="outline" size="sm">
            <Link href={'/wallet' as Route}>Money</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={'/dashboard' as Route}>Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={'/sadaka' as Route}>Sadaka</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={'/support' as Route}>Support</Link>
          </Button>
        </div>

        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Estimate only
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
          Zakat calculator
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Estimate 2.5% of qualifying wealth after immediate liabilities. Consult a qualified
          scholar for your personal situation.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Field
            id="cash"
            label="Cash, savings and investments (KES)"
            value={cash}
            onChange={setCash}
          />
          <Field
            id="gold"
            label="Gold and other qualifying assets (KES)"
            value={gold}
            onChange={setGold}
          />
          <Field
            id="debts"
            label="Immediate liabilities (KES)"
            value={debts}
            onChange={setDebts}
          />
        </div>

        <div className="mt-10 border-y border-border py-6">
          <p className="text-sm text-muted-foreground">
            Approximate nisab: KES {NISAB_KES.toLocaleString()}
          </p>
          <p className="mt-3 text-lg">
            Qualifying wealth: <strong>KES {wealth.toLocaleString()}</strong>
          </p>
          <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-primary">
            Estimated zakat: KES{' '}
            {zakat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11">
              <Link href={sadakaHref}>
                {zakat > 0 ? 'Give via Sadaka' : 'Browse Sadaka campaigns'}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={'/support' as Route}>Support Amanah</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        value={value || ''}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </div>
  );
}
