/** Build a WhatsApp click-to-chat URL with prefilled text (opens share sheet / chat picker). */
export function whatsappShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Compose a short share message; URL on its own line when present. */
export function composeWhatsAppMessage(input: {
  title?: string;
  body?: string;
  url?: string;
}): string {
  const parts: string[] = [];
  if (input.title?.trim()) parts.push(input.title.trim());
  if (input.body?.trim()) parts.push(input.body.trim());
  if (input.url?.trim()) parts.push(input.url.trim());
  return parts.join('\n\n');
}

export const JAMEIYAH_SHARE_BLURB =
  'Save together on Jameiyah — Kenyan circles without riba. Clear books for officers and members.';
