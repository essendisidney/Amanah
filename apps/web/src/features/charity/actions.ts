'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { callRpc } from '@/lib/supabase/rpc';
import { createClient } from '@/lib/supabase/server';
import { paymentProvider } from '@/lib/payments/provider';

export type CharityActionState = {
  success: boolean;
  message: string;
  intentId?: string;
  receiptCode?: string;
};

async function initiateAndSettleCharityPayment(input: {
  kind: 'sadaka' | 'platform_tip';
  amount: number;
  phone: string;
  metadata: Record<string, unknown>;
}): Promise<CharityActionState & { intentId?: string }> {
  const provider = paymentProvider();
  const requireReal = process.env.REQUIRE_REAL_PROVIDERS === 'true';

  if (provider === 'mpesa' && !/^\+[1-9]\d{7,14}$/.test(input.phone)) {
    return {
      success: false,
      message: 'M-Pesa requires an E.164 phone, e.g. +254712345678.',
    };
  }

  if (requireReal && provider === 'simulated') {
    return {
      success: false,
      message: 'Simulated payments disabled. Set PAYMENT_PROVIDER=mpesa|paystack.',
    };
  }

  const { data, error } = await callRpc('create_payment_intent', {
    p_amount: input.amount,
    p_currency: 'KES',
    p_phone: input.phone || null,
    p_provider: provider,
    p_idempotency_key: `${input.kind}:${provider}:${input.amount}:${Date.now()}`,
    p_metadata: { kind: input.kind, ...input.metadata },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('unauthenticated') || msg.includes('jwt')) {
      return {
        success: false,
        message: 'Sign in to complete a paid donation.',
      };
    }
    return { success: false, message: error.message };
  }

  const created = data as { ok?: boolean; error?: string; intent_id?: string } | null;
  if (!created?.ok || !created.intent_id) {
    return {
      success: false,
      message:
        created?.error === 'UNAUTHENTICATED'
          ? 'Sign in to complete a paid donation.'
          : created?.error ?? 'Could not start payment.',
    };
  }

  if (provider === 'simulated') {
    const { data: completeData, error: completeError } = await callRpc(
      'complete_payment_intent',
      {
        p_intent_id: created.intent_id,
        p_provider_reference: `sim:${created.intent_id}`,
        p_metadata: { source: 'simulated', kind: input.kind },
      },
    );
    if (completeError) return { success: false, message: completeError.message };
    const completed = completeData as {
      ok?: boolean;
      error?: string;
      receipt_code?: string;
    } | null;
    if (!completed?.ok) {
      return { success: false, message: completed?.error ?? 'Payment completion failed.' };
    }
    return {
      success: true,
      message: completed.receipt_code
        ? `Payment recorded. Receipt: ${completed.receipt_code}`
        : 'Payment recorded. Thank you.',
      intentId: created.intent_id,
      receiptCode: completed.receipt_code,
    };
  }

  if (provider === 'mpesa') {
    const { invokeMpesaStk } = await import('@/lib/payments/mpesa');
    const stk = await invokeMpesaStk({
      intentId: created.intent_id,
      amount: input.amount,
      phone: input.phone,
      description:
        input.kind === 'platform_tip' ? 'Amanah support' : 'Amanah sadaka',
    });
    if (!stk.ok) {
      return {
        success: false,
        message: stk.error
          ? `M-Pesa failed: ${stk.error}`
          : 'Could not start M-Pesa prompt.',
        intentId: created.intent_id,
      };
    }
    if (stk.fallback === 'simulated') {
      return {
        success: true,
        message:
          'Payment recorded (M-Pesa not configured — simulated completion).',
        intentId: created.intent_id,
      };
    }
    return {
      success: true,
      message:
        stk.customer_message ??
        'M-Pesa prompt sent. Confirm on your phone — receipt arrives when paid.',
      intentId: created.intent_id,
    };
  }

  if (provider === 'paystack') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { initializePaystackTransaction } = await import('@/lib/payments/paystack');
    const init = await initializePaystackTransaction({
      intentId: created.intent_id,
      amount: input.amount,
      currency: 'KES',
      email: user?.email,
      phone: input.phone || user?.phone || null,
      userId: user?.id,
      callbackPath: '/api/payments/paystack/callback',
      metadata: { kind: input.kind, ...input.metadata },
    });
    if (!init.ok) {
      return {
        success: false,
        message: `Paystack failed: ${init.error}`,
        intentId: created.intent_id,
      };
    }
    redirect(init.authorization_url);
  }

  return {
    success: true,
    message: 'Payment initiated.',
    intentId: created.intent_id,
  };
}

export async function donateAction(formData: FormData): Promise<CharityActionState> {
  const campaignId = String(formData.get('campaignId') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const amount = Number(formData.get('amount'));
  const phone = String(formData.get('donorPhone') ?? '').trim();
  if (!campaignId || !Number.isFinite(amount) || amount < 10) {
    return { success: false, message: 'Enter a donation of at least KES 10.' };
  }

  const paid = await initiateAndSettleCharityPayment({
    kind: 'sadaka',
    amount,
    phone,
    metadata: {
      campaign_id: campaignId,
      donor_name: String(formData.get('donorName') ?? '').trim() || null,
      donor_phone: phone || null,
      donor_email: String(formData.get('donorEmail') ?? '').trim() || null,
      is_anonymous: formData.get('anonymous') === 'on',
    },
  });

  // Fallback for guests on simulated: direct record without intent
  if (!paid.success && paid.message.includes('Sign in')) {
    const { data, error } = await callRpc('record_charity_donation', {
      p_campaign_id: campaignId,
      p_amount: amount,
      p_donor_name: String(formData.get('donorName') ?? '').trim() || null,
      p_donor_phone: phone || null,
      p_donor_email: String(formData.get('donorEmail') ?? '').trim() || null,
      p_is_anonymous: formData.get('anonymous') === 'on',
    });
    if (error) return { success: false, message: error.message };
    const result = data as { ok?: boolean; error?: string; receipt_code?: string } | null;
    if (!result?.ok) {
      return { success: false, message: result?.error ?? 'Could not record donation.' };
    }
    revalidatePath('/sadaka');
    if (slug) revalidatePath(`/sadaka/${slug}`);
    return {
      success: true,
      message: result.receipt_code
        ? `Donation recorded (no STK). Receipt: ${result.receipt_code}`
        : 'Donation recorded. Thank you.',
      receiptCode: result.receipt_code,
    };
  }

  if (paid.success) {
    revalidatePath('/sadaka');
    if (slug) revalidatePath(`/sadaka/${slug}`);
  }
  return paid;
}

export async function tipAction(formData: FormData): Promise<CharityActionState> {
  const amount = Number(formData.get('amount'));
  const phone = String(formData.get('phone') ?? '').trim();
  if (!Number.isFinite(amount) || amount < 10) {
    return { success: false, message: 'Enter a tip of at least KES 10.' };
  }

  const paid = await initiateAndSettleCharityPayment({
    kind: 'platform_tip',
    amount,
    phone,
    metadata: {},
  });

  if (!paid.success && paid.message.includes('Sign in')) {
    const { data, error } = await callRpc('record_platform_tip', {
      p_amount: amount,
      p_phone: phone || null,
    });
    if (error) return { success: false, message: error.message };
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return { success: false, message: result?.error ?? 'Could not record tip.' };
    }
    return { success: true, message: 'Tip recorded. Thank you for supporting Amanah.' };
  }

  return paid;
}

export async function donateFormAction(formData: FormData): Promise<void> {
  await donateAction(formData);
}

export async function tipFormAction(formData: FormData): Promise<void> {
  await tipAction(formData);
}

async function uploadSadakaImage(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          data: Buffer,
          options: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  userId: string,
  file: File,
  kind: 'cover' | 'gallery',
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 10 * 1024 * 1024) return null;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return null;

  const ext =
    file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}/${kind}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from('sadaka-media').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return null;

  const { data } = supabase.storage.from('sadaka-media').getPublicUrl(path);
  return data.publicUrl || null;
}

export async function submitCampaignAction(
  formData: FormData,
): Promise<CharityActionState & { slug?: string }> {
  const title = String(formData.get('title') ?? '').trim();
  const story = String(formData.get('story') ?? '').trim();
  const category = String(formData.get('category') ?? '');
  const target = Number(formData.get('targetAmount'));
  const beneficiaryName = String(formData.get('beneficiaryName') ?? '').trim();
  const beneficiaryPhone = String(formData.get('beneficiaryPhone') ?? '').trim();
  const kycUrl = String(formData.get('kycDocUrl') ?? '').trim();

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Sign in to create a campaign.' };
  }

  const { count } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');
  if ((count ?? 0) < 1) {
    return {
      success: false,
      message: 'Join an active circle before submitting a Sadaka campaign.',
    };
  }

  const coverFile = formData.get('coverImage');
  let coverUrl: string | null = null;
  if (coverFile instanceof File && coverFile.size > 0) {
    coverUrl = await uploadSadakaImage(supabase, user.id, coverFile, 'cover');
    if (!coverUrl) {
      return {
        success: false,
        message: 'Cover photo must be JPEG, PNG, or WebP under 10MB.',
      };
    }
  }

  const galleryUrls: string[] = [];
  const gallery = formData.getAll('galleryImages');
  for (const item of gallery.slice(0, 4)) {
    if (!(item instanceof File) || item.size === 0) continue;
    const url = await uploadSadakaImage(supabase, user.id, item, 'gallery');
    if (url) galleryUrls.push(url);
  }

  const { data, error } = await callRpc('submit_sadaka_campaign', {
    p_title: title,
    p_story: story,
    p_category: category,
    p_target_amount: target,
    p_beneficiary_name: beneficiaryName,
    p_beneficiary_phone: beneficiaryPhone,
    p_beneficiary_kyc_doc_url: kycUrl,
    p_slug: null,
    p_cover_image_url: coverUrl,
    p_public_media_urls: galleryUrls,
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string; slug?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Sign in to create a campaign.',
      INVALID_STORY: 'Story must be at least 40 characters.',
      INVALID_TARGET: 'Target must be at least KES 100.',
      BENEFICIARY_KYC_REQUIRED: 'Beneficiary name, M-Pesa number, and KYC documentation are required.',
      INVALID_CATEGORY: 'Choose a valid category.',
      NOT_A_MEMBER: 'Join an active circle before submitting a Sadaka campaign.',
    };
    return {
      success: false,
      message: messages[result?.error ?? ''] ?? result?.error ?? 'Could not submit campaign.',
    };
  }
  revalidatePath('/sadaka');
  revalidatePath('/sadaka/my');
  revalidatePath('/admin/sadaka');
  return {
    success: true,
    message: 'Submitted for admin review. It will appear under Active campaigns after approval.',
    slug: result.slug,
  };
}

export async function submitCampaignFormAction(formData: FormData): Promise<void> {
  await submitCampaignAction(formData);
}

export async function registerInstitutionAction(
  formData: FormData,
): Promise<CharityActionState> {
  const { data, error } = await callRpc('register_sadaka_institution', {
    p_name: String(formData.get('name') ?? '').trim(),
    p_type: String(formData.get('type') ?? ''),
    p_contact_person: String(formData.get('contactPerson') ?? '').trim(),
    p_registration_doc_url: String(formData.get('registrationDocUrl') ?? '').trim(),
    p_contact_phone: String(formData.get('contactPhone') ?? '').trim() || null,
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Could not register institution.' };
  }
  revalidatePath('/sadaka/adopt');
  revalidatePath('/admin/sadaka');
  return { success: true, message: 'Institution submitted for verification.' };
}

export async function registerInstitutionFormAction(formData: FormData): Promise<void> {
  await registerInstitutionAction(formData);
}

export async function createAdoptionProfileAction(
  formData: FormData,
): Promise<CharityActionState> {
  const { data, error } = await callRpc('create_adoption_profile', {
    p_institution_id: String(formData.get('institutionId') ?? ''),
    p_title: String(formData.get('title') ?? '').trim(),
    p_description: String(formData.get('description') ?? '').trim(),
    p_suggested_monthly_amount: Number(formData.get('monthlyAmount')),
  });
  if (error) return { success: false, message: error.message };
  const result = data as { ok?: boolean; error?: string; slug?: string } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Could not create adoption profile.' };
  }
  revalidatePath('/sadaka/adopt');
  return { success: true, message: 'Adoption profile published.' };
}

export async function createAdoptionProfileFormAction(formData: FormData): Promise<void> {
  await createAdoptionProfileAction(formData);
}

export async function startSponsorshipAction(
  formData: FormData,
): Promise<CharityActionState> {
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const { data, error } = await callRpc('start_sponsorship', {
    p_adoption_profile_id: String(formData.get('profileId') ?? ''),
    p_monthly_amount: Number(formData.get('monthlyAmount')),
    p_phone: phone,
  });
  if (error) return { success: false, message: error.message };
  const result = data as {
    ok?: boolean;
    error?: string;
    note?: string;
    needs_stk?: boolean;
    intent_id?: string;
    amount?: number;
    phone?: string;
  } | null;
  if (!result?.ok) {
    return { success: false, message: result?.error ?? 'Could not start sponsorship.' };
  }

  if (result.needs_stk && result.intent_id && result.phone) {
    const { invokeMpesaStk } = await import('@/lib/payments/mpesa');
    const stk = await invokeMpesaStk({
      intentId: result.intent_id,
      amount: Number(result.amount),
      phone: result.phone,
      description: 'Amanah adopt',
    });
    if (!stk.ok) {
      return {
        success: false,
        message: stk.error ?? 'Sponsorship created but M-Pesa STK failed.',
      };
    }
    revalidatePath('/sadaka/adopt');
    revalidatePath('/sadaka/my');
    return {
      success: true,
      message: stk.fallback
        ? 'Sponsorship started (payment simulated).'
        : 'Check your phone to approve the sponsorship STK payment.',
    };
  }

  revalidatePath('/sadaka/adopt');
  revalidatePath('/sadaka/my');
  return {
    success: true,
    message: result.note ?? 'Sponsorship started. First month recorded.',
  };
}

export async function startSponsorshipFormAction(formData: FormData): Promise<void> {
  await startSponsorshipAction(formData);
}
