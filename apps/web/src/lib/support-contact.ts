/**
 * Owner-configured support channels (env only — never invent contacts in code).
 * Set NEXT_PUBLIC_SUPPORT_EMAIL and/or NEXT_PUBLIC_SUPPORT_WHATSAPP (digits, e.g. 2547…).
 */

export type SupportContact = {
  email: string | null;
  whatsappE164: string | null;
  whatsappHref: string | null;
  mailtoHref: string | null;
  hasDirectChannel: boolean;
};

function cleanEmail(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

/** Digits only international MSISDN without + */
function cleanWhatsapp(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function getSupportContact(): SupportContact {
  const email = cleanEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  const whatsappE164 = cleanWhatsapp(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP);
  return {
    email,
    whatsappE164,
    whatsappHref: whatsappE164 ? `https://wa.me/${whatsappE164}` : null,
    mailtoHref: email ? `mailto:${email}?subject=${encodeURIComponent('Jameiyah support')}` : null,
    hasDirectChannel: Boolean(email || whatsappE164),
  };
}
