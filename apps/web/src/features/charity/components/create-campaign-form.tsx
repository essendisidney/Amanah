'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Input, Label, Textarea } from '@jamiya/ui';
import { KE_PHONE_PLACEHOLDER } from '@jamiya/shared';
import { submitCampaignAction, type CharityActionState } from '../actions';
import { prepareKycUploadFile } from '@/features/profile/lib/prepare-kyc-file';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES = [
  { value: 'medical', label: 'Medical' },
  { value: 'funeral', label: 'Funeral' },
  { value: 'education', label: 'Education' },
  { value: 'business_startup', label: 'Business startup' },
  { value: 'emergency_disaster', label: 'Emergency / disaster' },
  { value: 'institutional', label: 'Institutional' },
] as const;

type KycDoc = {
  id: string;
  document_type: string;
  storage_path: string;
  file_name: string | null;
  status: string;
};

export function CreateCampaignForm({ kycDocs = [] }: { kycDocs?: KycDoc[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CharityActionState | null>(null);
  const [kycMode, setKycMode] = useState<'pick' | 'upload'>(kycDocs.length ? 'pick' : 'upload');
  const [kycPath, setKycPath] = useState('');
  const [kycStatus, setKycStatus] = useState({ busy: false, ok: false, message: '' });

  // Upload straight from the browser into the member's private KYC folder (same as Profile → KYC),
  // so large phone photos never pass through the server action body limit.
  async function uploadKycDoc(file: File | undefined) {
    setKycPath('');
    if (!file) {
      setKycStatus({ busy: false, ok: false, message: '' });
      return;
    }
    setKycStatus({ busy: true, ok: false, message: 'Uploading…' });
    try {
      const prepared = await prepareKycUploadFile(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in again to upload.');
      const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document.jpg';
      const path = `${user.id}/${crypto.randomUUID()}/${safeName}`;
      const { error } = await supabase.storage.from('kyc-documents').upload(path, prepared, {
        contentType: prepared.type || 'image/jpeg',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      setKycPath(path);
      setKycStatus({ busy: false, ok: true, message: 'Uploaded. Only Jameiyah admins can see it.' });
    } catch (err) {
      setKycStatus({
        busy: false,
        ok: false,
        message: err instanceof Error ? err.message : 'Could not upload that file. Try a JPEG photo or a PDF.',
      });
    }
  }

  return (
    <form
      className="max-w-2xl space-y-4"
      action={(fd) => {
        if (kycMode === 'upload' && !kycPath) {
          setState({
            success: false,
            message: 'Upload a supporting document (a photo of an ID or a letter) before submitting.',
          });
          return;
        }
        startTransition(async () => {
          const result = await submitCampaignAction(fd);
          setState(result);
          if (result.success) {
            router.push('/sadaka/my');
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="title">Campaign title</Label>
        <Input id="title" name="title" required minLength={5} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          required
          className="h-10 w-full border border-input bg-background px-3"
          defaultValue="medical"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="story">Story (min 40 characters)</Label>
        <Textarea id="story" name="story" rows={6} required minLength={40} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="targetAmount">Target amount (KES)</Label>
        <Input id="targetAmount" name="targetAmount" type="number" min={100} required />
        <p className="text-xs text-muted-foreground">
          When this amount is raised, funds are released to the beneficiary M-Pesa.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="beneficiaryName">Beneficiary name</Label>
        <Input id="beneficiaryName" name="beneficiaryName" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="beneficiaryPhone">Beneficiary M-Pesa number</Label>
        <Input
          id="beneficiaryPhone"
          name="beneficiaryPhone"
          type="tel"
          placeholder={KE_PHONE_PLACEHOLDER}
          required
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="space-y-2">
          <Label htmlFor="coverImage">Campaign cover photo</Label>
          <p className="text-xs text-muted-foreground">
            Shown publicly on Sadaka after approval (JPEG / PNG / WebP).
          </p>
          <input
            id="coverImage"
            name="coverImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="galleryImages">Story photos (optional, up to 4)</Label>
          <p className="text-xs text-muted-foreground">
            Extra public photos for the campaign page — not private KYC.
          </p>
          <input
            id="galleryImages"
            name="galleryImages"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <Label>Supporting documentation (KYC — private)</Label>
        <p className="text-xs text-muted-foreground">
          For admin review only — not shown publicly. Prefer a document already uploaded in{' '}
          <Link href={'/profile' as Route} className="underline">
            Profile → KYC
          </Link>
          .
        </p>
        {kycDocs.length ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className={`inline-flex min-h-10 items-center rounded-md px-3 ${kycMode === 'pick' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
              onClick={() => setKycMode('pick')}
            >
              Use uploaded doc
            </button>
            <button
              type="button"
              className={`inline-flex min-h-10 items-center rounded-md px-3 ${kycMode === 'upload' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
              onClick={() => setKycMode('upload')}
            >
              Upload a new one
            </button>
          </div>
        ) : null}
        {kycMode === 'pick' && kycDocs.length ? (
          <select
            name="kycDocUrl"
            required
            className="h-10 w-full border border-input bg-background px-3 text-sm"
            defaultValue={kycDocs[0]?.storage_path}
          >
            {kycDocs.map((d) => (
              <option key={d.id} value={d.storage_path}>
                {d.document_type}
                {d.file_name ? ` · ${d.file_name}` : ''} · {d.status}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="kycDocument" className="text-sm font-normal">
              Photo of an ID, medical letter or similar (JPEG, PNG or PDF)
            </Label>
            <Input
              id="kycDocument"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => void uploadKycDoc(event.target.files?.[0])}
            />
            <input type="hidden" name="kycDocUrl" value={kycPath} />
            {kycStatus.message ? (
              <p
                role="status"
                className={`text-xs ${kycStatus.ok || kycStatus.busy ? 'text-muted-foreground' : 'text-destructive'}`}
              >
                {kycStatus.message}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {state ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending || kycStatus.busy}>
        {pending ? 'Submitting…' : 'Submit for admin review'}
      </Button>
    </form>
  );
}
