'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { Button } from '@jamiya/ui';

/**
 * Device app lock: a PIN (and optionally the phone's fingerprint / face unlock)
 * asked for when Jameiyah is opened again or comes back after a few minutes away.
 * Everything stays on this device; the sign-in session is unchanged.
 */

const KEY = 'jameiyah-lock';
const UNLOCKED = 'jameiyah-unlocked';
const AWAY_MS = 2 * 60 * 1000;
const MAX_TRIES = 5;

type LockConfig = { salt: string; hash: string; credId?: string };

type Copy = {
  enterPin: string;
  wrongPin: string;
  triesLeft: string;
  useDevice: string;
  forgot: string;
  locked: string;
  title: string;
  hint: string;
  turnOn: string;
  turnOff: string;
  choosePin: string;
  confirmPin: string;
  mismatch: string;
  on: string;
  off: string;
  addDevice: string;
  deviceOn: string;
  save: string;
  cancel: string;
};

const COPY: Record<'en' | 'sw', Copy> = {
  en: {
    enterPin: 'Enter your PIN',
    wrongPin: 'Wrong PIN.',
    triesLeft: 'tries left',
    useDevice: 'Use fingerprint or face',
    forgot: 'Forgot PIN? Sign out',
    locked: 'Jameiyah is locked',
    title: 'App lock',
    hint: 'Ask for a PIN when Jameiyah is opened again or you come back after 2 minutes. Only on this device.',
    turnOn: 'Set up app lock',
    turnOff: 'Turn off app lock',
    choosePin: 'Choose a 4-digit PIN',
    confirmPin: 'Enter the PIN again',
    mismatch: 'The PINs did not match. Try again.',
    on: 'On for this device',
    off: 'Off',
    addDevice: 'Also unlock with fingerprint or face',
    deviceOn: 'Fingerprint or face unlock is on',
    save: 'Save',
    cancel: 'Cancel',
  },
  sw: {
    enterPin: 'Weka PIN yako',
    wrongPin: 'PIN si sahihi.',
    triesLeft: 'majaribio yamebaki',
    useDevice: 'Tumia alama ya kidole au uso',
    forgot: 'Umesahau PIN? Toka',
    locked: 'Jameiyah imefungwa',
    title: 'Kufuli ya programu',
    hint: 'Uliza PIN Jameiyah inapofunguliwa tena au ukirudi baada ya dakika 2. Kwenye kifaa hiki tu.',
    turnOn: 'Weka kufuli',
    turnOff: 'Zima kufuli',
    choosePin: 'Chagua PIN ya tarakimu 4',
    confirmPin: 'Weka PIN tena',
    mismatch: 'PIN hazilingani. Jaribu tena.',
    on: 'Imewashwa kwenye kifaa hiki',
    off: 'Imezimwa',
    addDevice: 'Pia fungua kwa alama ya kidole au uso',
    deviceOn: 'Kufungua kwa kidole au uso kumewashwa',
    save: 'Hifadhi',
    cancel: 'Ghairi',
  },
};

function readConfig(): LockConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as LockConfig;
    return cfg?.salt && cfg?.hash ? cfg : null;
  } catch {
    return null;
  }
}

async function hashPin(salt: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function deviceUnlockSupported() {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && window.isSecureContext;
}

/** Ask the phone to verify its owner (fingerprint / face / screen lock). */
async function verifyWithDevice(credId: string): Promise<boolean> {
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(credId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return Boolean(got);
  } catch {
    return false;
  }
}

async function registerDevice(): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Jameiyah' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'jameiyah-app-lock',
          displayName: 'Jameiyah app lock',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return cred ? b64(cred.rawId) : null;
  } catch {
    return null;
  }
}

function setLockedAttr(locked: boolean) {
  if (locked) document.documentElement.setAttribute('data-locked', '');
  else document.documentElement.removeAttribute('data-locked');
}

function PinDots({ length }: { length: number }) {
  return (
    <div className="flex justify-center gap-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border-2 border-[#d8a038] transition-colors ${
            i < length ? 'bg-[#d8a038]' : 'bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

function PinPad({
  onDigit,
  onDelete,
  extra,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const cls =
    'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a038]';
  return (
    <div className="mx-auto grid w-fit grid-cols-3 gap-4">
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)} className={`${cls} bg-white/10 text-white hover:bg-white/20`}>
          {k}
        </button>
      ))}
      <div className="flex items-center justify-center">{extra}</div>
      <button type="button" onClick={() => onDigit('0')} className={`${cls} bg-white/10 text-white hover:bg-white/20`}>
        0
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className={`${cls} text-white/80 hover:bg-white/10`}>
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
}

/** Full-screen lock shown over the signed-in app. */
export function AppLockGate({
  locale,
  signOutAction,
}: {
  locale: string;
  signOutAction: () => Promise<void>;
}) {
  const t = COPY[locale === 'sw' ? 'sw' : 'en'];
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);
  const cfgRef = useRef<LockConfig | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const signOutForm = useRef<HTMLFormElement>(null);

  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(UNLOCKED, '1');
    } catch {
      /* ignore */
    }
    setLockedAttr(false);
    setLocked(false);
    setPin('');
    setError('');
    setTries(0);
  }, []);

  const tryDevice = useCallback(async () => {
    const credId = cfgRef.current?.credId;
    if (credId && (await verifyWithDevice(credId))) unlock();
  }, [unlock]);

  const lockNow = useCallback(() => {
    cfgRef.current = readConfig();
    if (!cfgRef.current) {
      setLockedAttr(false);
      return;
    }
    try {
      sessionStorage.removeItem(UNLOCKED);
    } catch {
      /* ignore */
    }
    setLockedAttr(true);
    setLocked(true);
    setPin('');
    setError('');
  }, []);

  useEffect(() => {
    cfgRef.current = readConfig();
    let unlockedThisTab = false;
    try {
      unlockedThisTab = sessionStorage.getItem(UNLOCKED) === '1';
    } catch {
      /* ignore */
    }
    if (cfgRef.current && !unlockedThisTab) {
      lockNow();
      if (cfgRef.current.credId) void tryDevice();
    } else {
      setLockedAttr(false);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (away >= AWAY_MS && readConfig()) {
        lockNow();
        if (cfgRef.current?.credId) void tryDevice();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lockNow, tryDevice]);

  useEffect(() => {
    if (!locked || pin.length < 4) return;
    const cfg = cfgRef.current;
    if (!cfg) {
      unlock();
      return;
    }
    void hashPin(cfg.salt, pin).then((h) => {
      if (h === cfg.hash) {
        unlock();
        return;
      }
      const next = tries + 1;
      setTries(next);
      setPin('');
      if (next >= MAX_TRIES) {
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        signOutForm.current?.requestSubmit();
        return;
      }
      setError(`${t.wrongPin} ${MAX_TRIES - next} ${t.triesLeft}`);
    });
  }, [pin, locked, tries, unlock, t]);

  useEffect(() => {
    if (!locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked]);

  if (!locked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.locked}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[#03201b] px-6 text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(216,160,56,0.18)_0%,_transparent_60%)]" aria-hidden />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <Lock className="h-6 w-6 text-[#d8a038]" />
        </span>
        <p className="font-[family-name:var(--font-grotesk)] text-2xl font-semibold tracking-tight">{t.enterPin}</p>
        <p className="min-h-5 text-sm text-[#f3c77a]" aria-live="polite">
          {error}
        </p>
        <PinDots length={pin.length} />
      </div>
      <div className="relative">
        <PinPad
          onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
          onDelete={() => setPin((p) => p.slice(0, -1))}
          extra={
            cfgRef.current?.credId ? (
              <button
                type="button"
                onClick={() => void tryDevice()}
                aria-label={t.useDevice}
                title={t.useDevice}
                className="flex h-16 w-16 items-center justify-center rounded-full text-[#d8a038] hover:bg-white/10"
              >
                <Fingerprint className="h-7 w-7" />
              </button>
            ) : null
          }
        />
      </div>
      <form
        ref={signOutForm}
        action={async () => {
          try {
            localStorage.removeItem(KEY);
            sessionStorage.removeItem(UNLOCKED);
          } catch {
            /* ignore */
          }
          setLockedAttr(false);
          await signOutAction();
        }}
        className="relative"
      >
        <button type="submit" className="min-h-11 px-4 text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline">
          {t.forgot}
        </button>
      </form>
    </div>
  );
}

/** Profile setting: turn the app lock on or off for this device. */
export function AppLockSettings({ locale }: { locale: string }) {
  const t = COPY[locale === 'sw' ? 'sw' : 'en'];
  const [enabled, setEnabled] = useState(false);
  const [hasDevice, setHasDevice] = useState(false);
  const [step, setStep] = useState<'idle' | 'choose' | 'confirm'>('idle');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [supportsDevice, setSupportsDevice] = useState(false);

  useEffect(() => {
    const cfg = readConfig();
    setEnabled(Boolean(cfg));
    setHasDevice(Boolean(cfg?.credId));
    setSupportsDevice(deviceUnlockSupported());
  }, []);

  useEffect(() => {
    if (pin.length < 4) return;
    if (step === 'choose') {
      setFirst(pin);
      setPin('');
      setStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (pin !== first) {
        setError(t.mismatch);
        setFirst('');
        setPin('');
        setStep('choose');
        return;
      }
      const salt = randomHex();
      void hashPin(salt, pin).then((hash) => {
        try {
          localStorage.setItem(KEY, JSON.stringify({ salt, hash } satisfies LockConfig));
          sessionStorage.setItem(UNLOCKED, '1');
        } catch {
          /* ignore */
        }
        setEnabled(true);
        setStep('idle');
        setPin('');
        setError('');
      });
    }
  }, [pin, step, first, t]);

  async function addDevice() {
    const cfg = readConfig();
    if (!cfg) return;
    const credId = await registerDevice();
    if (!credId) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...cfg, credId }));
    } catch {
      /* ignore */
    }
    setHasDevice(true);
  }

  function turnOff() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setEnabled(false);
    setHasDevice(false);
  }

  return (
    <section className="jameiyah-surface space-y-3 px-4 py-4 sm:px-5" aria-labelledby="app-lock-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="app-lock-title" className="text-base font-semibold text-foreground">
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.hint}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {enabled ? t.on : t.off}
        </span>
      </div>

      {step !== 'idle' ? (
        <div className="space-y-4 rounded-2xl bg-[#03201b] px-4 py-6 text-white">
          <p className="text-center text-sm font-medium">{step === 'choose' ? t.choosePin : t.confirmPin}</p>
          <p className="min-h-5 text-center text-sm text-[#f3c77a]" aria-live="polite">
            {error}
          </p>
          <PinDots length={pin.length} />
          <PinPad
            onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
            onDelete={() => setPin((p) => p.slice(0, -1))}
          />
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setStep('idle');
                setPin('');
                setFirst('');
                setError('');
              }}
              className="min-h-11 px-4 text-sm text-white/70 hover:text-white"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : enabled ? (
        <div className="flex flex-wrap gap-2">
          {supportsDevice && !hasDevice ? (
            <Button type="button" className="min-h-11" onClick={() => void addDevice()}>
              <Fingerprint className="h-4 w-4" />
              {t.addDevice}
            </Button>
          ) : null}
          {hasDevice ? <p className="w-full text-sm text-muted-foreground">{t.deviceOn}</p> : null}
          <Button type="button" variant="outline" className="min-h-11" onClick={turnOff}>
            {t.turnOff}
          </Button>
        </div>
      ) : (
        <Button type="button" className="min-h-11" onClick={() => setStep('choose')}>
          <Lock className="h-4 w-4" />
          {t.turnOn}
        </Button>
      )}
    </section>
  );
}
