import type { Metadata } from 'next';
import { AppPage } from '@/components/app-page';
import Link from 'next/link';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/server';
import { JamiyaKycUploadForm } from '@/features/circles/components/jamiya-kyc-upload-form';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';

export const metadata: Metadata = { title: 'Circle registration KYC' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function CircleRegistrationPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/phone?next=/circles/${slug}/registration`);

  const { data: jamiya } = await supabase
    .from('jamiyas')
    .select('id, name, slug, registration_status, registration_number')
    .eq('slug', slug)
    .maybeSingle();
  if (!jamiya) notFound();

  const j = jamiya as {
    id: string;
    name: string;
    slug: string;
    registration_status: string;
    registration_number: string | null;
  };

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('jamiya_id', j.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (membership as { role?: string; status?: string } | null)?.role;
  const canUpload =
    (membership as { status?: string } | null)?.status === 'active' &&
    ['circle_admin', 'chair', 'secretary', 'treasurer'].includes(role ?? '');

  const { data: docs } = await supabase
    .from('jamiya_kyc_documents')
    .select('id, document_type, status, file_name, created_at, review_notes')
    .eq('jamiya_id', j.id)
    .order('created_at', { ascending: false });

  return (
    <AppPage>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">
          Registered chama
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          KYC · {j.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={j.registration_status} />
          {j.registration_number ? (
            <span className="text-sm text-muted-foreground">No. {j.registration_number}</span>
          ) : null}
        </div>
        <p className="mt-2 text-muted-foreground">
          {j.registration_status === 'approved'
            ? 'Registration approved. Keep documents current if the registrar asks for updates.'
            : j.registration_status === 'rejected'
              ? 'Registration was rejected. Check notes below, fix the papers, and upload again.'
              : j.registration_status === 'pending'
                ? 'Documents are with compliance for review. You will get an in-app notification when decided.'
                : 'Upload registration papers, constitution, minutes, or bank letters for this circle.'}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={`/circles/${slug}` as Route}>Back to circle</Link>
        </Button>
      </div>

      {canUpload ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
            Upload document
          </h2>
          <JamiyaKycUploadForm
            jamiyaId={j.id}
            slug={slug}
            registrationNumber={j.registration_number}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Officers (admin, chair, secretary, treasurer) can upload circle KYC documents.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Uploaded documents
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {((docs ?? []) as Array<{
            id: string;
            document_type: string;
            status: string;
            file_name: string;
            created_at: string;
            review_notes: string | null;
          }>).map((d) => (
            <li key={d.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.document_type.replace(/_/g, ' ')}</span>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-1 text-muted-foreground">
                {d.file_name} · {new Date(d.created_at).toLocaleString()}
              </p>
              {d.review_notes ? (
                <p className="mt-1 text-muted-foreground">Notes: {d.review_notes}</p>
              ) : null}
            </li>
          ))}
          {!docs?.length ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">No documents yet.</li>
          ) : null}
        </ul>
      </section>
    
    </AppPage>
  );
}
