import { normalizePhone254 } from '@jamiya/shared';

/**
 * Priority Kenya mobiles that skip OTP cooldown / hourly / daily caps
 * so ops can unblock login SMS immediately.
 * Values may be 07… / 254… / +254… — normalized before compare.
 */
const PRIORITY_RAW = [
  '0722210711',
  '254722210711',
  ...(process.env.SMS_PRIORITY_PHONES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

const PRIORITY = new Set(
  PRIORITY_RAW.map((p) => {
    try {
      return normalizePhone254(p);
    } catch {
      return '';
    }
  }).filter(Boolean),
);

export function isSmsPriorityPhone(phone254: string): boolean {
  return PRIORITY.has(normalizePhone254(phone254));
}
