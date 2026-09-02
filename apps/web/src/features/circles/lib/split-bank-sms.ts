import { parseBankSms, type ParsedBankSms } from '@/lib/bank-sms-parse';

export type BankSmsChunk = {
  text: string;
  parsed: ParsedBankSms;
};

/** Split pasted SMS into messages (blank-line separated) and parse each. */
export function splitAndParseBankSms(paste: string): BankSmsChunk[] {
  const normalized = paste.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks = normalized
    .split(/\n{2,}/)
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter((c) => c.length >= 12);

  const used = chunks.length > 0 ? chunks : [normalized.replace(/\s+/g, ' ').trim()];

  return used.map((text) => ({
    text,
    parsed: parseBankSms(text),
  }));
}

export const BANK_SMS_PROVIDERS = [
  'manual',
  'equity',
  'mpesa',
  'kcb',
  'coop',
  'absa',
  'ncba',
  'stanbic',
  'other',
] as const;

export type BankSmsProvider = (typeof BANK_SMS_PROVIDERS)[number];

export function normalizeBankProvider(value: string): BankSmsProvider {
  const v = value.toLowerCase().trim();
  return (BANK_SMS_PROVIDERS as readonly string[]).includes(v)
    ? (v as BankSmsProvider)
    : 'other';
}
