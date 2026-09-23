'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Label } from '@jamiya/ui';

const NISAB_KES = 1_100_000;
const ESTIMATE_KEY = 'jameiyah.zakat.estimate';

export function ZakatCalculator() {
  const [cash, setCash] = useState(0);
  const [gold, setGold] = useState(0);
  const [debts, setDebts] = useState(0);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ESTIMATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        cash?: number;
        gold?: number;
        debts?: number;
      };
      if (typeof parsed.cash === 'number') setCash(parsed.cash);
      if (typeof parsed.gold === 'number') setGold(parsed.gold);
      if (typeof parsed.debts === 'number') setDebts(parsed.debts);
    } catch {
      // ignore corrupt local estimate
    }
  }, []);

  const wealth = Math.max(0, cash + gold - debts);
  const zakat = wealth >= NISAB_KES ? wealth * 0.025 : 0;
  const rounded = Math.round(zakat);

  const sadakaHref = useMemo(() => {
    if (rounded <= 0) return '/sadaka' as Route;
    return `/sadaka?amount=${rounded}&from=zakat` as Route;
  }, [rounded]);

  function persistEstimate() {
    try {
      sessionStorage.setItem(
        ESTIMATE_KEY,
        JSON.stringify({ cash, gold, debts, zakat: rounded, at: Date.now() }),
      );
      setSavedNote('Estimate saved on this device.');
    } catch {
      setSavedNote('Could not save on this device.');
    }
  }

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
          <p className="text-xs text-muted-foreground">
            Estimate only. Giving via Sadaka is optional — ask a scholar for your case.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href={sadakaHref} onClick={persistEstimate}>
                {rounded > 0 ? `Give KES ${rounded.toLocaleString()} via Sadaka` : 'Browse Sadaka'}
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={persistEstimate}
            >
              Save estimate
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={'/shariah' as Route}>Shariah stance</Link>
            </Button>
          </div>
          {savedNote ? <p className="text-xs text-muted-foreground">{savedNote}</p> : null}
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
