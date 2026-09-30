import { Check } from 'lucide-react';
import type { LandingCopy } from './landing-copy';

/** Illustrative phone showing a merry-go-round board. Static, example data only. */
export function PayoutBoardMockup({ copy }: { copy: LandingCopy['mock'] }) {
  const m = copy.months;
  const slots = [
    { n: 1, name: 'Amina', note: `${copy.paidOut} · ${m.jul}`, done: true },
    { n: 2, name: 'Wanjiru', note: `${copy.paidOut} · ${m.aug}`, done: true },
    { n: 3, name: 'Fatuma', note: `${copy.nextPayout} · 30 ${m.sep}`, next: true },
    { n: 4, name: 'Achieng', note: m.oct },
    { n: 5, name: 'Zainab', note: m.nov },
  ];

  return (
    <figure className="relative mx-auto w-[300px] select-none" aria-label={copy.caption}>
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(197,160,68,0.18),transparent)]" />
      <div className="rounded-[2.4rem] border border-[#0b4a3c]/15 bg-[#0b2b23] p-2.5 shadow-[0_24px_60px_-20px_rgba(11,74,60,0.45)]">
        <div className="overflow-hidden rounded-[1.9rem] bg-[#f8fafc]">
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-[#0b2b23]/15" />
          <div className="px-4 pb-5 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a6414]">{copy.kind}</p>
            <p className="mt-0.5 text-base font-bold text-[#0b4a3c]">Umoja Sisters</p>

            <div className="mt-3 rounded-2xl bg-[#0d5c45] px-4 py-3 text-white">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/70">{copy.pot}</p>
              <p className="text-2xl font-bold">Ksh 60,000</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/20">
                <div className="h-1.5 w-3/4 rounded-full bg-[#d8b45a]" />
              </div>
              <p className="mt-1.5 text-[11px] text-white/80">{copy.paidCount}</p>
            </div>

            <ul className="mt-3 space-y-1.5">
              {slots.map((s) => (
                <li
                  key={s.n}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
                    s.next ? 'border-[#c5a044]/60 bg-[#f7f0de]' : 'border-[#0b4a3c]/10 bg-white'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      s.done ? 'bg-[#0d5c45] text-white' : 'bg-[#e6f2ed] text-[#0b4a3c]'
                    }`}
                  >
                    {s.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
                  </span>
                  <span className="text-[13px] font-semibold text-[#111827]">{s.name}</span>
                  <span className={`ml-auto text-[11px] ${s.next ? 'font-semibold text-[#8a6414]' : 'text-[#6b7280]'}`}>
                    {s.note}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[12px] ring-1 ring-[#0b4a3c]/10">
              <span className="text-[#374151]">{copy.statement}</span>
              <span className="font-semibold text-[#0d5c45]">{copy.allPaid}</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-[#7a8f86]">{copy.caption}</figcaption>
    </figure>
  );
}
