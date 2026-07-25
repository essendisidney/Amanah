import { NextResponse } from 'next/server';
import { createApiClient } from '@/lib/supabase/api';

export async function GET(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabase.from('profiles').select('kyc_status').eq('id', user.id).maybeSingle(),
    supabase
      .from('kyc_documents')
      .select('id, document_type, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    ok: true,
    kycStatus: (profile as { kyc_status?: string } | null)?.kyc_status ?? 'not_started',
    documents: documents ?? [],
  });
}

/**
 * Register a KYC document after the mobile client uploads to Storage.
 * Body: { documentType, storagePath }
 */
export async function POST(request: Request) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    documentType?: string;
    storagePath?: string;
  } | null;

  if (!body?.documentType || !body.storagePath) {
    return NextResponse.json(
      { ok: false, error: 'DOCUMENT_TYPE_AND_PATH_REQUIRED' },
      { status: 400 },
    );
  }

  if (!body.storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ ok: false, error: 'INVALID_PATH' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('kyc_documents')
    .insert({
      user_id: user.id,
      document_type: body.documentType,
      storage_path: body.storagePath,
      status: 'uploaded',
      file_name: body.storagePath.split('/').pop() ?? 'document',
    })
    .select('id, document_type, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase
    .from('profiles')
    .update({ kyc_status: 'under_review' })
    .eq('id', user.id)
    .in('kyc_status', ['not_started', 'rejected', 'pending']);

  return NextResponse.json({ ok: true, document: data });
}
