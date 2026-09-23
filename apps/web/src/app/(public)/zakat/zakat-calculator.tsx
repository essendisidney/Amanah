'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';

const NISAB_KES = 1_100_000;

export function ZakatCalculator() {
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
    <>
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Your wealth</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <div className="grid gap-3.5 sm:grid-cols-2">
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
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">Estimate</h2>
        <div className="amanah-surface space-y-3.5 px-4 py-4 sm:px-5">
          <p className="text-sm text-muted-foreground">
            Approximate nisab: KES {NISAB_KES.toLocaleString()}
          </p>
          <p className="text-sm text-foreground">
            Qualifying wealth:{' '}
            <span className="font-semibold">KES {wealth.toLocaleString()}</span>
          </p>
          <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Estimated zakat: KES{' '}
            {zakat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href={sadakaHref}>
                {zakat > 0 ? 'Give via Sadaka' : 'Browse Sadaka campaigns'}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={'/support' as Route}>Support Jameiyah</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
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
        className="h-11 text-base sm:h-10 sm:text-sm"
      />
    </div>
  );
}
