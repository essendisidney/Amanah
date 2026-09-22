import { NextResponse } from 'next/server';
import { isComplianceRole } from '@jamiya/auth';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/supabase/auth';
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
    .select('id, name, slug, currency, challenge_kind')
    .eq('slug', slug)
    .maybeSingle();
  const jamiya = jamiyaData as {
    id: string;
    name: string;
    slug: string;
    currency: string;
    challenge_kind: string | null;
  } | null;
  if (!jamiya) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const profile = await getUserProfile(user.id);
  const isPlatformAdmin = isComplianceRole(profile?.platform_role ?? 'member');

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
  if (!me && !isPlatformAdmin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const isOfficer = me
    ? ['circle_admin', 'chair', 'treasurer', 'secretary'].includes(me.role)
    : false;
  const canBrowseMembers = isOfficer || isPlatformAdmin;

  let memberId = me?.id ?? '';
  if (memberIdParam && canBrowseMembers) memberId = memberIdParam;
  if (!memberId && canBrowseMembers) {
    const { data: firstMember } = await supabase
      .from('members')
      .select('id')
      .eq('jamiya_id', jamiya.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    memberId = (firstMember as { id: string } | null)?.id ?? '';
  }
  if (!memberId) {
    return NextResponse.json({ error: 'NO_MEMBERS' }, { status: 404 });
  }

  // Officers / platform admins can export any member PDF; other members need Starter/Pro for others.
  if (me && memberId !== me.id && !isOfficer && !isPlatformAdmin) {
    const { data: planPack } = await callRpc('get_circle_plan', { p_jamiya_id: jamiya.id });
    const plan = planPack as {
      ok?: boolean;
      plan?: { exports_included?: boolean };
    } | null;
    if (!plan?.plan?.exports_included) {
      return NextResponse.json(
        {
          error: 'EXPORTS_NOT_INCLUDED',
          message:
            'PDF exports for other members require Starter or Pro. Upgrade in Officer → Circle plan.',
        },
        { status: 402 },
      );
    }
  }

  const { data } = await callRpc('member_circle_statement', {
    p_jamiya_id: jamiya.id,
    p_member_id: memberId,
  });
  const stmt = data as {
    ok?: boolean;
    member_code?: string | null;
    role?: string;
    status?: string;
    summary?: Record<string, unknown>;
    share_lots?: Array<Record<string, unknown>>;
    contributions?: Array<Record<string, unknown>>;
    penalties?: Array<Record<string, unknown>>;
    loans?: Array<Record<string, unknown>>;
    savings_pockets?: Array<Record<string, unknown>>;
    book_entries?: Array<Record<string, unknown>>;
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
    challengeKind: jamiya.challenge_kind,
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="jameiyah-${slug}-statement.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
