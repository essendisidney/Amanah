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

  const path = String(formData.get('path') ?? '/');
  revalidatePath(path || '/');
}
