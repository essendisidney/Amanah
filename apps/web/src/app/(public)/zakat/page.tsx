'use client';

import { useState } from 'react';
import { Input, Label } from '@jamiya/ui';

const NISAB_KES = 1_100_000;

export default function ZakatPage() {
  const [cash, setCash] = useState(0);
  const [gold, setGold] = useState(0);
  const [debts, setDebts] = useState(0);
  const wealth = Math.max(0, cash + gold - debts);
  const zakat = wealth >= NISAB_KES ? wealth * 0.025 : 0;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Estimate only</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">Zakat calculator</h1>
      <p className="mt-4 text-lg text-muted-foreground">Estimate 2.5% of qualifying wealth after immediate liabilities. Consult a qualified scholar for your personal situation.</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Field id="cash" label="Cash, savings and investments (KES)" value={cash} onChange={setCash} />
        <Field id="gold" label="Gold and other qualifying assets (KES)" value={gold} onChange={setGold} />
        <Field id="debts" label="Immediate liabilities (KES)" value={debts} onChange={setDebts} />
      </div>
      <div className="mt-10 border-y border-border py-6">
        <p className="text-sm text-muted-foreground">Approximate nisab: KES {NISAB_KES.toLocaleString()}</p>
        <p className="mt-3 text-lg">Qualifying wealth: <strong>KES {wealth.toLocaleString()}</strong></p>
        <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-primary">Estimated zakat: KES {zakat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
      </div>
    </main>
  );
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0" value={value || ''} onChange={(event) => onChange(Number(event.target.value) || 0)} /></div>;
}
