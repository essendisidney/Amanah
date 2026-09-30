import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { LandingCopy } from './landing-copy';

/**
 * Hero illustration: a merry-go-round circle on a phone shown in 3D perspective, with an
 * M-Pesa receipt and a statement card floating in front at their own depth.
 * Pure CSS 3D (no WebGL, no JS); motion stops for reduced-motion users (.jm-* in globals.css).
 */
const GREEN = '#004038';
const GOLD = '#D8A038';

const AVATAR_TONES = [
  { bg: '#e3efe9', fg: GREEN },
  { bg: '#f7ecd6', fg: '#7a5410' },
  { bg: '#fde6e1', fg: '#9a3b2e' },
  { bg: '#e6ecfb', fg: '#2e4a9a' },
  { bg: '#efe6f8', fg: '#6b3a9a' },
];

function Avatar({ name, tone, size = 28 }: { name: string; tone: number; size?: number }) {
  const t = AVATAR_TONES[tone % AVATAR_TONES.length]!;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white"
      style={{ width: size, height: size, background: t.bg, color: t.fg, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

const depth = (z: number, extra = ''): CSSProperties => ({ transform: `translateZ(${z}px) ${extra}`.trim() });

export function PayoutBoardMockup({ copy }: { copy: LandingCopy['mock'] }) {
  const m = copy.months;
  const slots = [
    { n: 1, name: 'Amina', note: `${copy.paidOut} · ${m.jul}`, state: 'done' as const },
    { n: 2, name: 'Mwanaisha', note: `${copy.paidOut} · ${m.aug}`, state: 'done' as const },
    { n: 3, name: 'Fatuma', note: `${copy.nextLabel} · 30 ${m.sep}`, state: 'next' as const },
    { n: 4, name: 'Zawadi', note: m.oct, state: 'you' as const },
    { n: 5, name: 'Halima', note: m.nov, state: 'wait' as const },
  ];
  // Ring: r=38 → circumference ≈ 238.8; 9/12 paid → 75% filled.
  const C = 238.8;
  const filled = C * 0.25;

  return (
    <figure
      className="relative mx-auto w-[270px] select-none sm:w-[300px]"
      style={{ perspective: '1300px', perspectiveOrigin: '50% 40%' }}
      aria-label={copy.caption}
    >
      {/* Soft brand glow behind everything */}
      <div
        aria-hidden
        className="absolute -inset-12 -z-10 rounded-[4rem] blur-2xl"
        style={{
          background:
            'radial-gradient(closest-side, rgba(216,160,56,0.24), transparent 70%), radial-gradient(60% 50% at 30% 80%, rgba(0,64,56,0.2), transparent 70%)',
        }}
      />
      {/* Ground shadow */}
      <div
        aria-hidden
        className="absolute -bottom-6 left-1/2 -z-10 h-10 w-[78%] -translate-x-1/2 rounded-[50%] blur-xl"
        style={{ background: 'rgba(0,40,34,0.35)' }}
      />

      {/* 3D stage */}
      <div className="jm-tilt relative" style={{ transformStyle: 'preserve-3d' }}>
        {/* Phone body depth (layers behind the face give it a visible edge) */}
        {[18, 12, 6].map((z) => (
          <div
            key={z}
            aria-hidden
            className="absolute inset-0 rounded-[2.6rem]"
            style={{ background: z === 18 ? '#01100d' : z === 12 ? '#041a16' : '#0a2a24', ...depth(-z, `translateX(${z / 3}px)`) }}
          />
        ))}

        {/* Phone face */}
        <div
          className="relative rounded-[2.6rem] p-[9px]"
          style={{
            background: 'linear-gradient(155deg,#1d4a41 0%,#0b2a24 40%,#061c18 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            ...depth(0),
          }}
        >
          <div className="relative overflow-hidden rounded-[2.1rem] bg-[#f7f8f6]">
            {/* Screen glare */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 32%)' }}
            />
            {/* Status bar + notch */}
            <div className="relative flex h-7 items-center justify-between px-5 text-[10px] font-semibold text-[#0b1f1b]">
              <span>9:41</span>
              <span className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-[#061c18]" />
              <span className="flex items-center gap-1" aria-hidden>
                <span className="flex items-end gap-[2px]">
                  {[4, 6, 8, 10].map((h) => (
                    <span key={h} className="w-[2.5px] rounded-sm bg-[#0b1f1b]" style={{ height: h }} />
                  ))}
                </span>
                <span className="ml-1 h-[9px] w-[18px] rounded-[3px] border border-[#0b1f1b] p-[1px]">
                  <span className="block h-full w-3/4 rounded-[1px] bg-[#0b1f1b]" />
                </span>
              </span>
            </div>

            <div className="px-4 pb-4 pt-2">
              {/* Circle header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9a6c12' }}>
                    {copy.kind}
                  </p>
                  <p className="text-[17px] font-bold leading-tight" style={{ color: GREEN }}>
                    {copy.circle}
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] text-[#5b6b66]">{copy.place}</p>
                </div>
                <div className="flex -space-x-2 pt-1">
                  {['Amina', 'Mwanaisha', 'Fatuma'].map((n, i) => (
                    <Avatar key={n} name={n} tone={i} size={22} />
                  ))}
                </div>
              </div>

              {/* Pot card with progress ring */}
              <div
                className="mt-3 flex items-center gap-2.5 rounded-2xl p-3 text-white sm:gap-3 sm:p-3.5 shadow-[0_10px_24px_-14px_rgba(0,64,56,0.9)]"
                style={{ background: `linear-gradient(145deg, ${GREEN} 0%, #00564a 100%)` }}
              >
                <svg viewBox="0 0 96 96" className="h-[68px] w-[68px] shrink-0 -rotate-90 sm:h-[84px] sm:w-[84px]" aria-hidden>
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
                    strokeDashoffset={filled}
                  />
                  <text
                    x="48"
                    y="55"
                    transform="rotate(90 48 48)"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="21"
                    fontWeight="700"
                  >
                    9/12
                  </text>
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-white/65 sm:text-[9.5px]">{copy.pot}</p>
                  <p className="whitespace-nowrap text-[19px] font-bold leading-tight sm:text-[22px]">Ksh 60,000</p>
                  <p className="mt-0.5 text-[10.5px] text-white/80">{copy.paidOf}</p>
                </div>
              </div>

              {/* Payout order */}
              <ul className="mt-3 space-y-1.5">
                {slots.map((s, i) => (
                  <li
                    key={s.n}
                    className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-[7px] ${
                      s.state === 'next' ? 'jm-pulse' : ''
                    }`}
                    style={
                      s.state === 'next'
                        ? { background: '#fbf3e1', borderColor: 'rgba(216,160,56,0.7)' }
                        : { background: '#fff', borderColor: 'rgba(0,64,56,0.08)' }
                    }
                  >
                    {s.state === 'done' ? (
                      <span
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: GREEN }}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                      </span>
                    ) : (
                      <Avatar name={s.name} tone={i} size={22} />
                    )}
                    <span className="text-[12.5px] font-semibold text-[#0f1f1b]">{s.name}</span>
                    {s.state === 'you' ? (
                      <span
                        className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: '#e3efe9', color: GREEN }}
                      >
                        {copy.you}
                      </span>
                    ) : null}
                    <span
                      className="ml-auto text-[10.5px]"
                      style={s.state === 'next' ? { color: '#8a5f0c', fontWeight: 700 } : { color: '#6b7a75' }}
                    >
                      {s.note}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-center text-[10px] text-[#7a8a85]">{copy.more}</p>

              {/* Pay button */}
              <div
                className="mt-2.5 flex h-10 items-center justify-center gap-2 rounded-xl text-[12.5px] font-bold shadow-[0_8px_18px_-10px_rgba(154,108,18,0.9)]"
                style={{ background: GOLD, color: '#2a1d05' }}
              >
                <span
                  className="rounded-[4px] px-1 text-[9px] font-extrabold tracking-wide text-white"
                  style={{ background: '#1f8a3a' }}
                >
                  M-PESA
                </span>
                {copy.payCta}
              </div>
            </div>
          </div>
        </div>

        {/* Floating: M-Pesa receipt (in front of the phone) */}
        <div className="absolute -left-12 -top-9 hidden sm:block" style={depth(70)}>
          <div className="jm-in" style={{ animationDelay: '0.9s' }}>
            <div className="jm-float-slow flex w-[196px] items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-[0_22px_44px_-18px_rgba(0,40,34,0.55)] ring-1 ring-black/5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: '#1f8a3a' }}
              >
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#0f1f1b]">{copy.toastTitle}</p>
                <p className="truncate text-[10.5px] text-[#5b6b66]">{copy.toastBody}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Floating: statement (further forward) */}
        <div className="absolute -right-12 -bottom-9 hidden sm:block" style={depth(110)}>
          <div className="jm-in" style={{ animationDelay: '1.4s' }}>
            <div className="jm-float-slow rounded-2xl bg-white px-3 py-2.5 shadow-[0_22px_44px_-18px_rgba(0,40,34,0.55)] ring-1 ring-black/5 [animation-delay:-3s]">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: '#9a6c12' }}>
                {copy.statementTitle}
              </p>
              <p className="mt-0.5 text-[12px] font-bold" style={{ color: GREEN }}>
                {copy.statementBody}
              </p>
            </div>
          </div>
        </div>

        {/* Floating: gold 0% badge (behind the phone's right edge) */}
        <div className="absolute -right-11 top-[36%] hidden sm:block" style={depth(40)}>
          <div className="jm-in" style={{ animationDelay: '1.8s' }}>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-[15px] font-extrabold shadow-[0_14px_30px_-12px_rgba(154,108,18,0.9)]"
              style={{ background: `radial-gradient(circle at 35% 30%, #f3d58d, ${GOLD} 60%, #a8781f)`, color: '#2a1d05' }}
            >
              0%
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-8 text-center text-xs text-[#7a8f86]">{copy.caption}</figcaption>
    </figure>
  );
}
