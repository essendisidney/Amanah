export type ParsedBankSms = {
  provider: 'mpesa' | 'equity' | 'other';
  amount: number | null;
  currency: string;
  direction: 'credit' | 'debit' | null;
  externalRef: string | null;
};

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/\s/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Best-effort Kenya bank / M-Pesa SMS parser for alert ingestion. */
export function parseBankSms(text: string): ParsedBankSms {
  const body = text.replace(/\s+/g, ' ').trim();
  const lower = body.toLowerCase();

  let provider: ParsedBankSms['provider'] = 'other';
  if (/\bmpesa\b|\bm-pesa\b|\bsafaricom\b/.test(lower) || /^[A-Z0-9]{10}\s+confirmed/i.test(body)) {
    provider = 'mpesa';
  } else if (/\bequity\b|\beazzy\b/.test(lower)) {
    provider = 'equity';
  }

  let direction: ParsedBankSms['direction'] = null;
  if (
    /\breceived\b|\bhave received\b|\bcredited\b|\bdeposit\b|\bfrom\b/.test(lower) &&
    !/\bsent to\b|\bpaid to\b|\bdebited\b|\bwithdrawn\b/.test(lower)
  ) {
    direction = 'credit';
  } else if (/\bsent to\b|\bpaid to\b|\bdebited\b|\bwithdrawn\b|\bpurchase\b/.test(lower)) {
    direction = 'debit';
  } else if (/\breceived\b|\bcredited\b/.test(lower)) {
    direction = 'credit';
  }

  let amount: number | null = null;
  const amountMatchers = [
    /(?:ksh|kes|ksh\.|kes\.)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /(?:amount|amt)[:\s]+(?:ksh|kes)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  ];
  for (const re of amountMatchers) {
    const m = body.match(re);
    if (m?.[1]) {
      amount = parseAmount(m[1]);
      if (amount) break;
    }
  }

  let externalRef: string | null = null;
  const refMatchers = [
    /\b([A-Z0-9]{10})\s+Confirmed/i,
    /\b(?:Ref|Reference|Receipt|Code)[:\s#]*([A-Z0-9-]{6,})/i,
    /\bTransaction\s+(?:ID|Code)[:\s]*([A-Z0-9-]{6,})/i,
  ];
  for (const re of refMatchers) {
    const m = body.match(re);
    if (m?.[1]) {
      externalRef = m[1].toUpperCase();
      break;
    }
  }

  return {
    provider,
    amount,
    currency: 'KES',
    direction,
    externalRef,
  };
}
