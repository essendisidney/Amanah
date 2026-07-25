'use server';

import {
  forgotPasswordSchema,
  loginSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  registerSchema,
  resetPasswordSchema,
  sanitizePlainText,
} from '@jamiya/shared';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getSafeRedirectPath,
  mapZodErrors,
  type AuthActionState,
} from '../lib/types';

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: sanitizePlainText(fullName, 120),
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    message: 'Check your email to confirm your account before signing in.',
  };
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      message: 'Invalid email or password.',
    };
  }

  const next = getSafeRedirectPath(String(formData.get('next') ?? '/dashboard'));
  redirect(next);
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Enter a valid email address.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  // Always succeed to avoid email enumeration
  return {
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  redirect('/dashboard');
}

export async function requestPhoneOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = phoneOtpRequestSchema.safeParse({
    phone: formData.get('phone'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Enter a valid phone number in E.164 format.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    message: 'OTP sent. Enter the code to continue.',
  };
}

export async function verifyPhoneOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = phoneOtpVerifySchema.safeParse({
    phone: formData.get('phone'),
    token: formData.get('token'),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: 'Enter a valid phone number and 6-digit code.',
      fieldErrors: mapZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: 'sms',
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
