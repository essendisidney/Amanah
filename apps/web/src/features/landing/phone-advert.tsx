import type { CSSProperties, ReactNode } from 'react';
import { Activity, Bell, Check, CircleUserRound, Download, Home, Users, Wallet } from 'lucide-react';
import type { LandingCopy } from './landing-copy';

/**
 * Home hero "advert": a lifelike phone that plays five short scenes on a loop
 * (circle → M-Pesa → 0% loan → Sadaka → statement) with a synced caption underneath.
 * Pure CSS (no video, no JS): the whole loop is 20s, 4s per scene; see .jm-ad-* in globals.css.
 * Reduced-motion users see the first scene, still.
 */
const GREEN = '#004038';
const GOLD = '#D8A038';
const SCENE_SECONDS = 4;

const delay = (scene: number): CSSProperties => ({ animationDelay: `${scene * SCENE_SECONDS}s` });

function Scene({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="jm-ad-slide absolute inset-0 px-4 pt-1" style={delay(index)} aria-hidden={index > 0}>
      {children}
    </div>
  );
}

function Initial({ name, tone }: { name: string; tone: number }) {
  const tones = [
    ['#e3efe9', GREEN],
    ['#f7ecd6', '#7a5410'],
    ['#fde6e1', '#9a3b2e'],
    ['#e6ecfb', '#2e4a9a'],
  ] as const;
  const [bg, fg] = tones[tone % tones.length]!;
  return (
    <span
      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={{ background: bg, color: fg }}
    >
      {name[0]}
    </span>
  );
}

export function PhoneAdvert({ ad, mock }: { ad: LandingCopy['ad']; mock: LandingCopy['mock'] }) {
  const m = mock.months;
  const C = 238.8; // ring circumference for r=38

  return (
    <figure
      className="relative mx-auto w-[276px] select-none sm:w-[296px]"
      style={{ perspective: '1400px', perspectiveOrigin: '50% 40%' }}
      aria-label={ad.captions.map((c) => c.title).join('. ')}
    >
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-[4rem] blur-2xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(216,160,56,0.24), transparent 70%), radial-gradient(60% 50% at 30% 80%, rgba(0,64,56,0.22), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[70px] left-1/2 -z-10 h-10 w-[76%] -translate-x-1/2 rounded-[50%] blur-xl"
        style={{ background: 'rgba(0,40,34,0.35)' }}
      />

      {/* 3D stage */}
      <div className="jm-tilt-soft relative" style={{ transformStyle: 'preserve-3d' }}>
        {[16, 10, 5].map((z) => (
          <div
            key={z}
            aria-hidden
            className="absolute inset-0 rounded-[3.1rem]"
            style={{ background: z === 16 ? '#2b3331' : z === 10 ? '#4a5552' : '#6f7b78', transform: `translateZ(-${z}px) translateX(${z / 3}px)` }}
          />
        ))}

        {/* Titanium frame */}
        <div
          className="relative rounded-[3.1rem] p-[3px]"
          style={{
            background: 'linear-gradient(145deg,#b9c3c0 0%,#5d6866 22%,#2a3230 50%,#56615e 78%,#aab4b1 100%)',
            transform: 'translateZ(0)',
          }}
        >
          {/* Side buttons */}
          <span aria-hidden className="absolute -left-[3px] top-[96px] h-7 w-[3px] rounded-l bg-[#6f7b78]" />
          <span aria-hidden className="absolute -left-[3px] top-[138px] h-12 w-[3px] rounded-l bg-[#6f7b78]" />
          <span aria-hidden className="absolute -left-[3px] top-[196px] h-12 w-[3px] rounded-l bg-[#6f7b78]" />
          <span aria-hidden className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r bg-[#6f7b78]" />

          {/* Bezel */}
          <div className="rounded-[2.95rem] bg-[#050807] p-[9px]">
            {/* Screen */}
            <div className="relative h-[572px] overflow-hidden rounded-[2.4rem] bg-[#f6f7f5]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30"
                style={{ background: 'linear-gradient(118deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 30%)' }}
              />

              {/* Status bar + Dynamic Island */}
              <div className="relative z-20 flex h-[34px] items-center justify-between px-6 text-[11px] font-semibold text-[#0b1f1b]">
                <span>9:41</span>
                <span className="absolute left-1/2 top-2 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
                <span className="flex items-center gap-1" aria-hidden>
                  <span className="flex items-end gap-[2px]">
                    {[4, 6, 8, 10].map((h) => (
                      <span key={h} className="w-[2.5px] rounded-sm bg-[#0b1f1b]" style={{ height: h }} />
                    ))}
                  </span>
                  <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-[#0b1f1b] p-[1px]">
                    <span className="block h-full w-4/5 rounded-[1px] bg-[#0b1f1b]" />
                  </span>
                </span>
              </div>

              {/* App bar */}
              <div className="relative z-20 flex h-[42px] items-center justify-between px-4">
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                    style={{ background: `linear-gradient(145deg, ${GREEN}, #00564a)` }}
                  >
                    J
                  </span>
                  <span className="text-[14px] font-bold" style={{ color: GREEN }}>
                    Jameiyah
                  </span>
                </span>
                <span className="relative">
                  <Bell className="h-[18px] w-[18px] text-[#34443f]" aria-hidden />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: GOLD }} />
                </span>
              </div>

              {/* Scenes */}
              <div className="relative h-[430px]">
                {/* 1 · Circle */}
                <Scene index={0}>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9a6c12' }}>
                    {mock.kind}
                  </p>
                  <p className="text-[18px] font-bold leading-tight" style={{ color: GREEN }}>
                    {mock.circle}
                  </p>
                  <p className="truncate text-[10.5px] text-[#5b6b66]">{mock.place}</p>
                  <div
                    className="mt-3 flex items-center gap-2.5 rounded-2xl p-3 text-white"
                    style={{ background: `linear-gradient(145deg, ${GREEN}, #00564a)` }}
                  >
                    <svg viewBox="0 0 96 96" className="h-[70px] w-[70px] shrink-0 -rotate-90" aria-hidden>
                      <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="9" />
                      <circle
                        className="jm-ring"
                        cx="48"
                        cy="48"
                        r="38"
                        fill="none"
                        stroke={GOLD}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={C * 0.25}
                      />
                      <text x="48" y="55" transform="rotate(90 48 48)" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="700">
                        9/12
                      </text>
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/65">{mock.pot}</p>
                      <p className="whitespace-nowrap text-[20px] font-bold leading-tight">Ksh 60,000</p>
                      <p className="text-[10.5px] text-white/80">{mock.paidOf}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {[
                      { name: 'Amina', note: `${mock.paidOut} · ${m.jul}`, done: true },
                      { name: 'Mwanaisha', note: `${mock.paidOut} · ${m.aug}`, done: true },
                      { name: 'Fatuma', note: `${mock.nextLabel} · 30 ${m.sep}`, next: true },
                      { name: 'Zawadi', note: m.oct, you: true },
                    ].map((s, i) => (
                      <li
                        key={s.name}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-[7px] ${s.next ? 'jm-pulse' : ''}`}
                        style={
                          s.next
                            ? { background: '#fbf3e1', borderColor: 'rgba(216,160,56,0.7)' }
                            : { background: '#fff', borderColor: 'rgba(0,64,56,0.08)' }
                        }
                      >
                        {s.done ? (
                          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: GREEN }}>
                            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                          </span>
                        ) : (
                          <Initial name={s.name} tone={i} />
                        )}
                        <span className="text-[12.5px] font-semibold text-[#0f1f1b]">{s.name}</span>
                        {s.you ? (
                          <span className="rounded-full px-1.5 text-[9px] font-bold uppercase" style={{ background: '#e3efe9', color: GREEN }}>
                            {mock.you}
                          </span>
                        ) : null}
                        <span className="ml-auto text-[10.5px]" style={s.next ? { color: '#8a5f0c', fontWeight: 700 } : { color: '#6b7a75' }}>
                          {s.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Scene>

                {/* 2 · Pay with M-Pesa (then the PIN prompt, then success) */}
                <Scene index={1}>
                  <p className="text-[18px] font-bold" style={{ color: GREEN }}>
                    {ad.pay.title}
                  </p>
                  <p className="text-[11px] text-[#5b6b66]">{mock.circle}</p>
                  <div className="mt-4 rounded-2xl border border-[#004038]/10 bg-white p-4 text-center">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b7a75]">{ad.pay.due}</p>
                    <p className="mt-1 text-[34px] font-extrabold leading-none" style={{ color: GREEN }}>
                      Ksh 5,000
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[#004038]/10 bg-white px-3 py-2.5">
                    <span className="rounded-[4px] px-1 text-[9px] font-extrabold text-white" style={{ background: '#1f8a3a' }}>
                      M-PESA
                    </span>
                    <span className="text-[12px] font-medium text-[#0f1f1b]">{ad.pay.method}</span>
                    <Check className="ml-auto h-4 w-4" style={{ color: '#1f8a3a' }} aria-hidden />
                  </div>
                  <div className="mt-4 flex h-11 items-center justify-center rounded-xl text-[14px] font-bold" style={{ background: GOLD, color: '#2a1d05' }}>
                    {ad.pay.button}
                  </div>

                  {/* M-Pesa PIN prompt (SIM toolkit style) */}
                  <div className="jm-ad-pop absolute inset-0 flex items-center justify-center bg-black/35 px-5" style={delay(1)}>
                    <div className="w-full rounded-xl bg-white p-4 shadow-2xl">
                      <p className="text-[13px] font-extrabold" style={{ color: '#1f8a3a' }}>
                        M-PESA
                      </p>
                      <p className="mt-1.5 text-[12px] leading-snug text-[#1a1a1a]">{ad.pay.stkBody}</p>
                      <div className="mt-3 flex h-9 items-center gap-2 border-b-2 border-[#1f8a3a] px-1 text-[18px] tracking-[0.3em] text-[#1a1a1a]">
                        ••••
                      </div>
                      <div className="mt-3 flex justify-end gap-5 text-[12px] font-bold" style={{ color: '#1f8a3a' }}>
                        <span>{ad.pay.stkCancel}</span>
                        <span>{ad.pay.stkSend}</span>
                      </div>
                    </div>
                  </div>

                  {/* Success */}
                  <div className="jm-ad-ok absolute inset-x-4 top-24 rounded-2xl bg-white p-5 text-center shadow-[0_20px_40px_-18px_rgba(0,40,34,0.6)] ring-1 ring-black/5" style={delay(1)}>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: '#1f8a3a' }}>
                      <Check className="h-6 w-6" strokeWidth={3} aria-hidden />
                    </span>
                    <p className="mt-3 text-[15px] font-bold text-[#0f1f1b]">{ad.pay.ok}</p>
                    <p className="mt-0.5 text-[11.5px] text-[#5b6b66]">{ad.pay.okBody}</p>
                  </div>
                </Scene>

                {/* 3 · 0% loan */}
                <Scene index={2}>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9a6c12' }}>
                    Qard Hassan
                  </p>
                  <p className="text-[18px] font-bold" style={{ color: GREEN }}>
                    {ad.loan.title}
                  </p>
                  <div className="mt-3 rounded-2xl p-4 text-white" style={{ background: `linear-gradient(145deg, ${GREEN}, #00564a)` }}>
                    <p className="text-[11px] text-white/70">{ad.loan.limitLabel}</p>
                    <p className="text-[28px] font-extrabold leading-tight">Ksh 15,000</p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="jm-ad-zero text-[46px] font-black leading-none" style={{ color: GOLD, ...delay(2) }}>
                        0%
                      </span>
                      <span className="pb-1.5 text-[12px] font-semibold text-white/80">{ad.loan.rateLabel}</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-xl border border-[#004038]/10 bg-white px-3 py-2.5 text-[12px]">
                    <p className="flex justify-between">
                      <span className="text-[#5b6b66]">{ad.loan.term}</span>
                    </p>
                    <p className="font-semibold text-[#0f1f1b]">{ad.loan.monthly}</p>
                  </div>
                  <div className="mt-3 flex h-11 items-center justify-center rounded-xl text-[14px] font-bold text-white" style={{ background: GREEN }}>
                    {ad.loan.button}
                  </div>
                  <p className="mt-2 text-center text-[10.5px] text-[#6b7a75]">{ad.loan.note}</p>
                </Scene>

                {/* 4 · Sadaka */}
                <Scene index={3}>
                  <p className="text-[18px] font-bold" style={{ color: GREEN }}>
                    Sadaka
                  </p>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#004038]/10 bg-white">
                    <div
                      className="flex h-[108px] items-end p-3"
                      style={{ background: 'linear-gradient(160deg,#1a6b5c 0%,#004038 55%,#8a6414 130%)' }}
                    >
                      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold" style={{ color: GREEN }}>
                        {ad.sadaka.place}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-[14px] font-bold text-[#0f1f1b]">{ad.sadaka.campaign}</p>
                      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#e8eeec]">
                        <div className="jm-ad-bar h-full rounded-full" style={{ background: GOLD, width: '72%', ...delay(3) }} />
                      </div>
                      <p className="mt-2 text-[12px]">
                        <span className="font-bold" style={{ color: GREEN }}>
                          Ksh 216,400
                        </span>{' '}
                        <span className="text-[#5b6b66]">{ad.sadaka.of}</span>
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[#6b7a75]">{ad.sadaka.donors}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex h-11 items-center justify-center rounded-xl text-[14px] font-bold" style={{ background: GOLD, color: '#2a1d05' }}>
                    {ad.sadaka.button}
                  </div>
                  <p className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-[#6b7a75]">
                    <Check className="h-3 w-3" style={{ color: '#1f8a3a' }} aria-hidden />
                    {ad.sadaka.receipt}
                  </p>
                </Scene>

                {/* 5 · Statement */}
                <Scene index={4}>
                  <p className="text-[18px] font-bold" style={{ color: GREEN }}>
                    {ad.statement.title}
                  </p>
                  <p className="text-[11px] text-[#5b6b66]">{mock.circle} · 2026</p>
                  <ul className="mt-3 divide-y divide-[#004038]/8 rounded-2xl border border-[#004038]/10 bg-white">
                    {ad.statement.rows.map((row, i) => (
                      <li key={row} className="flex items-center gap-2 px-3 py-2.5 text-[12px]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: '#1f8a3a' }}>
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="text-[#0f1f1b]">{row}</span>
                        <span className="ml-auto font-semibold text-[#0f1f1b]">{i === 3 ? 'Ksh 2,500' : 'Ksh 5,000'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(145deg, ${GREEN}, #00564a)` }}>
                    <span className="text-[11px] text-white/75">{ad.statement.total}</span>
                    <span className="text-[20px] font-extrabold">Ksh 45,000</span>
                  </div>
                  <div className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-[13.5px] font-bold" style={{ borderColor: GREEN, color: GREEN }}>
                    <Download className="h-4 w-4" aria-hidden />
                    {ad.statement.button}
                  </div>
                </Scene>
              </div>

              {/* Tab bar */}
              <div className="absolute inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-4 pt-2">
                <div className="grid grid-cols-5 text-center text-[9px] font-medium text-[#6b7a75]">
                  {[Home, Users, Wallet, Activity, CircleUserRound].map((Icon, i) => (
                    <span key={i} className="flex flex-col items-center gap-0.5" style={i === 1 ? { color: GREEN, fontWeight: 700 } : undefined}>
                      <Icon className="h-[17px] w-[17px]" aria-hidden />
                      {ad.tabs[i]}
                    </span>
                  ))}
                </div>
                <span aria-hidden className="mx-auto mt-2 block h-1 w-24 rounded-full bg-black/80" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption synced to the scenes */}
      <figcaption className="relative mt-7 h-[58px] text-center">
        {ad.captions.map((c, i) => (
          <div key={c.title} className="jm-ad-cap absolute inset-x-0 top-0" style={delay(i)}>
            <p className="text-[15px] font-bold" style={{ color: GREEN }}>
              {c.title}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[#5a6f66]">{c.body}</p>
          </div>
        ))}
      </figcaption>
      <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
        {ad.captions.map((c, i) => (
          <span key={c.title} className="jm-ad-dot h-2 w-2 rounded-full" style={delay(i)} />
        ))}
      </div>
    </figure>
  );
}
