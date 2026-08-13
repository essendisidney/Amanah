'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isLocale, type Locale } from './config';

export async function setLocaleAction(formData: FormData): Promise<void> {
  const next = String(formData.get('locale') ?? '');
  if (!isLocale(next)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next as Locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  // Bust the whole App Router tree so Soft Navigation does not keep stale EN RSC payloads.
  revalidatePath('/', 'layout');
  const path = String(formData.get('path') ?? '');
  if (path && path !== '/') {
    revalidatePath(path);
  }
}
