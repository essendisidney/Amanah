'use client';

import { useState, useTransition } from 'react';
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

export function CreateCampaignForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CharityActionState | null>(null);

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
      <div className="space-y-1">
        <Label htmlFor="kycDocUrl">KYC document URL / storage path</Label>
        <Input
          id="kycDocUrl"
          name="kycDocUrl"
          placeholder="Upload ID to KYC storage, then paste path"
          required
        />
        <p className="text-xs text-muted-foreground">
          Required for review. Use your KYC upload path from Profile, or a secure document link.
        </p>
      </div>
      {state ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit for review'}
      </Button>
    </form>
  );
}
