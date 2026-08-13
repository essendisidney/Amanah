import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callRpc } from '@/lib/supabase/rpc';
import { buildStatementPdf } from '@/lib/statements/build-statement-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const memberIdParam = new URL(request.url).searchParams.get('memberId');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { data: jamiyaData } = await supabase
    .from('jamiyas')
    .select('id, name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
  } | null;
  if (!jamiya) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { data: myMembership } = await supabase
    .from('members')
    .select('id, role, status, member_code')
    .eq('jamiya_id', jamiya.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const me = myMembership as {
    id: string;
    role: string;
    member_code: string | null;
  } | null;
  if (!me) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const isOfficer = ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(me.role);
  let memberId = me.id;
  if (memberIdParam && isOfficer) memberId = memberIdParam;

  const { data } = await callRpc('member_circle_statement', {
    p_jamiya_id: jamiya.id,
    p_member_id: memberId,
  });
  const stmt = data as {
    ok?: boolean;
    member_code?: string | null;
    role?: string;
    status?: string;
    contributions?: Array<Record<string, unknown>>;
    penalties?: Array<Record<string, unknown>>;
    loans?: Array<Record<string, unknown>>;
    savings_pockets?: Array<Record<string, unknown>>;
  } | null;

  if (!stmt?.ok) {
    return NextResponse.json({ error: 'STATEMENT_FAILED' }, { status: 400 });
  }

  const bytes = await buildStatementPdf({
    circleName: jamiya.name,
    currency: jamiya.currency,
    memberLabel: stmt.member_code ?? memberId.slice(0, 8),
    generatedAt: new Date().toISOString().slice(0, 10),
    stmt,
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="amanah-${slug}-statement.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
