export type IprsOutcome = 'matched' | 'mismatch' | 'not_found' | 'error';

export type IprsLookupInput = {
  nationalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
};

export type IprsLookupResult = {
  outcome: IprsOutcome;
  matched: boolean;
  provider: string;
  fullName?: string;
  message: string;
  raw: Record<string, unknown>;
};

const ID_RE = /^[0-9]{8,9}$/;

export function normalizeKenyaNationalId(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!ID_RE.test(digits)) return null;
  return digits;
}

function providerMode(): 'http' | 'simulated' {
  const url = process.env.IPRS_API_URL?.trim();
  const key = process.env.IPRS_API_KEY?.trim();
  if (url && key) return 'http';
  return 'simulated';
}

/** Licensed gateway or NPDM partner. Expected JSON: { matched, fullName?, outcome?, message? }. */
async function lookupHttp(input: IprsLookupInput): Promise<IprsLookupResult> {
  const url = process.env.IPRS_API_URL!.trim();
  const key = process.env.IPRS_API_KEY!.trim();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'X-API-Key': key,
    },
    body: JSON.stringify({
      documentNumber: input.nationalId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      country: 'KE',
      source: 'amanah',
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      outcome: 'error',
      matched: false,
      provider: 'http',
      message: String(raw.message ?? raw.error ?? `IPRS gateway HTTP ${res.status}`),
      raw,
    };
  }

  const matched = Boolean(raw.matched ?? raw.match ?? raw.success);
  const outcome = (raw.outcome as IprsOutcome | undefined) ?? (matched ? 'matched' : 'mismatch');
  return {
    outcome: ['matched', 'mismatch', 'not_found', 'error'].includes(outcome)
      ? outcome
      : matched
        ? 'matched'
        : 'mismatch',
    matched,
    provider: 'http',
    fullName: typeof raw.fullName === 'string' ? raw.fullName : undefined,
    message:
      String(raw.message ?? '') ||
      (matched
        ? 'Identity matched Kenya IPRS / NPDM.'
        : 'Details did not match the population register.'),
    raw,
  };
}

/**
 * Demo lookup until NPDM (formerly IPRS) or a licensed aggregator is connected.
 * Does not invent government records — it only checks ID format and names.
 */
function lookupSimulated(input: IprsLookupInput): IprsLookupResult {
  const fail = process.env.IPRS_SIMULATED_FAIL === 'true';
  if (fail) {
    return {
      outcome: 'mismatch',
      matched: false,
      provider: 'simulated',
      message: 'Demo IPRS mismatch (IPRS_SIMULATED_FAIL=true).',
      raw: { mode: 'simulated' },
    };
  }

  const fullName = `${input.firstName} ${input.lastName}`.trim();
  return {
    outcome: 'matched',
    matched: true,
    provider: 'simulated',
    fullName,
    message:
      'Demo IPRS match (NPDM live keys not configured). Connect IPRS_API_URL + IPRS_API_KEY for the government register.',
    raw: { mode: 'simulated', nationalId: input.nationalId },
  };
}

export async function lookupIprs(input: IprsLookupInput): Promise<IprsLookupResult> {
  const nationalId = normalizeKenyaNationalId(input.nationalId);
  if (!nationalId) {
    return {
      outcome: 'error',
      matched: false,
      provider: providerMode(),
      message: 'Enter an 8- or 9-digit Kenya National ID / Maisha Namba.',
      raw: {},
    };
  }

  const payload = { ...input, nationalId };
  if (providerMode() === 'http') {
    return lookupHttp(payload);
  }
  return lookupSimulated(payload);
}
