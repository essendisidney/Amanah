import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { reviewKycDocumentAction } from '@/features/admin/actions/admin-actions';
import { reviewJamiyaKycAction } from '@/features/circles/actions/jamiya-kyc-actions';
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

export default async function AdminKycPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const [{ data }, { data: circleData }] = await Promise.all([
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
  ]);

  const docs = (data ?? []) as unknown as DocRow[];
  const circleDocs = (circleData ?? []) as unknown as CircleDocRow[];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Personal KYC
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No personal KYC documents submitted.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {docs.map((doc) => (
              <li key={doc.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize">
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
                  <div className="flex flex-wrap gap-2">
                    <form action={reviewKycDocumentAction}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="decision" value="approved" />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={reviewKycDocumentAction} className="flex gap-2">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <input
                        name="reason"
                        placeholder="Rejection reason"
                        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">
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

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Circle / chama KYC
        </h2>
        {circleDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No circle registration documents yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {circleDocs.map((doc) => (
              <li key={doc.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize">
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
                  <div className="flex flex-wrap gap-2">
                    <form action={reviewJamiyaKycAction}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={reviewJamiyaKycAction} className="flex gap-2">
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <input
                        name="notes"
                        placeholder="Rejection notes"
                        className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">
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
    </div>
  );
}
