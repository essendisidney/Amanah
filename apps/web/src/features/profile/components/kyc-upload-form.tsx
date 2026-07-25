'use client';

import { useActionState } from 'react';
import { Alert, AlertDescription, Button, Label } from '@jamiya/ui';
import { uploadKycDocumentAction } from '../actions/profile-actions';
import { initialProfileActionState } from '../lib/state';

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving license' },
  { value: 'proof_of_address', label: 'Proof of address' },
  { value: 'selfie', label: 'Selfie' },
  { value: 'other', label: 'Other' },
] as const;

export function KycUploadForm() {
  const [state, formAction, pending] = useActionState(
    uploadKycDocumentAction,
    initialProfileActionState,
  );

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="documentType">Document type</Label>
          <select
            id="documentType"
            name="documentType"
            required
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            defaultValue="national_id"
          >
            {DOCUMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">File (JPEG, PNG, WebP, or PDF · max 10MB)</Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Uploading…' : 'Upload document'}
        </Button>
      </form>
    </div>
  );
}
