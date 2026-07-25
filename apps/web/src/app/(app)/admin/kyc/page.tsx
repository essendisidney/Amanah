import type { Metadata } from 'next';
import { formatDate } from '@jamiya/shared';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { reviewKycDocumentAction } from '@/features/admin/actions/admin-actions';
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

export default async function AdminKycPage() {
  await requireAdminAccess('compliance');
  const supabase = await createClient();
  const { data } = await supabase
    .from('kyc_documents')
    .select('id, user_id, document_type, status, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const docs = (data ?? []) as unknown as DocRow[];

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">KYC review</h2>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No KYC documents submitted.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {docs.map((doc) => (
            <li key={doc.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium capitalize">
                    {doc.document_type.replaceAll('_', ' ')}
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
    </div>
  );
}
