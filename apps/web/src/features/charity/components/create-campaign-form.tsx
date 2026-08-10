'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, Button, Input, Label, Textarea } from '@jamiya/ui';
import { submitCampaignAction, type CharityActionState } from '../actions';

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
  const [kycMode, setKycMode] = useState<'pick' | 'paste'>(kycDocs.length ? 'pick' : 'paste');

  return (
    <form
      className="max-w-2xl space-y-4"
      action={(fd) => {
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
          placeholder="+2547…"
          required
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <Label>Supporting documentation (KYC)</Label>
        <p className="text-xs text-muted-foreground">
          Required for admin review. Prefer a document already uploaded in{' '}
          <Link href={'/profile' as Route} className="underline">
            Profile → KYC
          </Link>
          .
        </p>
        {kycDocs.length ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className={`rounded-md px-2 py-1 ${kycMode === 'pick' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
              onClick={() => setKycMode('pick')}
            >
              Use uploaded doc
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 ${kycMode === 'paste' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
              onClick={() => setKycMode('paste')}
            >
              Paste link / path
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
          <Input
            id="kycDocUrl"
            name="kycDocUrl"
            placeholder="Storage path or secure document URL"
            required
          />
        )}
      </div>

      {state ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit for admin review'}
      </Button>
    </form>
  );
}
