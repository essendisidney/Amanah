import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { reviewKycDocumentAction } from '@/features/admin/actions/admin-actions';
import { reviewJamiyaKycAction } from '@/features/circles/actions/jamiya-kyc-actions';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Admin · KYC' };
export const dynamic = 'force-dynamic';

type DocRow = {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  file_name: string;
  created_at: string;
};

type CircleDocRow = {
  id: string;
  jamiya_id: string;
  document_type: string;
  status: string;
  file_name: string;
  created_at: string;
  jamiyas: { name: string; slug: string } | null;
};

type IprsRow = {
  id: string;
  user_id: string;
  national_id: string;
  first_name: string;
  last_name: string;
  outcome: string;
  matched: boolean;
  provider: string;
  created_at: string;
};

export default async function AdminKycPage() {
  await requireAdminAccess('compliance', '/admin/kyc');
  const supabase = await createClient();
  const [{ data }, { data: circleData }, { data: iprsData }] = await Promise.all([
    supabase
      .from('kyc_documents')
      .select('id, user_id, document_type, status, file_name, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('jamiya_kyc_documents')
      .select('id, jamiya_id, document_type, status, file_name, created_at, jamiyas(name, slug)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('iprs_verifications')
      .select(
        'id, user_id, national_id, first_name, last_name, outcome, matched, provider, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const docs = ((data ?? []) as unknown as DocRow[]).slice().sort((a, b) => {
    const aAction = a.status === 'uploaded' || a.status === 'under_review' ? 0 : 1;
    const bAction = b.status === 'uploaded' || b.status === 'under_review' ? 0 : 1;
    return aAction - bAction;
  });
  const circleDocs = ((circleData ?? []) as unknown as CircleDocRow[]).slice().sort((a, b) => {
    const aAction = a.status === 'uploaded' || a.status === 'under_review' ? 0 : 1;
    const bAction = b.status === 'uploaded' || b.status === 'under_review' ? 0 : 1;
    return aAction - bAction;
  });
  const iprsRows = (iprsData ?? []) as unknown as IprsRow[];
  const pendingPersonal = docs.filter(
    (d) => d.status === 'uploaded' || d.status === 'under_review',
  ).length;
  const pendingCircle = circleDocs.filter(
    (d) => d.status === 'uploaded' || d.status === 'under_review',
  ).length;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        title="KYC review"
        subtitle={
          pendingPersonal + pendingCircle === 0
            ? 'No documents waiting.'
            : `${pendingPersonal + pendingCircle} waiting · personal ${pendingPersonal} · circle ${pendingCircle}`
        }
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link href={'/admin' as Route}>Inbox</Link>
          </Button>
        }
      />

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Personal KYC</h3>
        {docs.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No personal KYC documents submitted.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {docs.map((doc) => (
              <li key={doc.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-foreground">
                      {doc.document_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doc.file_name} · {formatDate(doc.created_at)} · user{' '}
                      {doc.user_id.slice(0, 8)}…
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                {doc.status === 'uploaded' || doc.status === 'under_review' ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <form action={reviewKycDocumentAction} className="w-full sm:w-auto">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <Button type="submit" className="min-h-11 w-full sm:w-auto">
                        Approve
                      </Button>
                    </form>
                    <form
                      action={reviewKycDocumentAction}
                      className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <input
                        name="reason"
                        placeholder="Rejection reason"
                        className="min-h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm sm:min-w-[12rem]"
                      />
                      <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">Circle KYC</h3>
        {circleDocs.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No circle registration documents yet.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {circleDocs.map((doc) => (
              <li key={doc.id} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-foreground">
                      {doc.document_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doc.jamiyas?.name ?? 'Circle'} · {doc.file_name} ·{' '}
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                {doc.status === 'uploaded' || doc.status === 'under_review' ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <form action={reviewJamiyaKycAction} className="w-full sm:w-auto">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" className="min-h-11 w-full sm:w-auto">
                        Approve
                      </Button>
                    </form>
                    <form
                      action={reviewJamiyaKycAction}
                      className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <input
                        name="notes"
                        placeholder="Rejection notes"
                        className="min-h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm sm:min-w-[12rem]"
                      />
                      <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">IPRS lookups</h3>
        {iprsRows.length === 0 ? (
          <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
            No IPRS checks yet.
          </p>
        ) : (
          <ul className="amanah-surface divide-y divide-border/70">
            {iprsRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {row.first_name} {row.last_name} · ID {row.national_id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.provider} · {formatDate(row.created_at)} · user {row.user_id.slice(0, 8)}…
                  </p>
                </div>
                <StatusBadge status={row.outcome} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
