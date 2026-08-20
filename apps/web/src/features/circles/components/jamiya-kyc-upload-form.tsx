'use client';

import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import {
  uploadJamiyaKycDocumentAction,
  type JamiyaKycActionState,
} from '../actions/jamiya-kyc-actions';
import { prepareKycUploadFile } from '@/features/profile/lib/prepare-kyc-file';

const DOCUMENT_TYPES = [
  { value: 'certificate_of_registration', label: 'Certificate of registration' },
  { value: 'constitution', label: 'Constitution / bylaws' },
  { value: 'minutes', label: 'Meeting minutes' },
  { value: 'bank_letter', label: 'Bank letter' },
  { value: 'group_photo', label: 'Group photo' },
  { value: 'other', label: 'Other' },
] as const;

const initial: JamiyaKycActionState = { success: false, message: '' };

export function JamiyaKycUploadForm({
  jamiyaId,
  slug,
  registrationNumber,
}: {
  jamiyaId: string;
  slug: string;
  registrationNumber?: string | null;
}) {
  const [state, setState] = useState<JamiyaKycActionState>(initial);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      setState({ success: false, message: 'Choose a file to upload.' });
      return;
    }

    setPending(true);
    setState(initial);
    try {
      const prepared = await prepareKycUploadFile(file);
      formData.set('file', prepared);
      const result = await uploadJamiyaKycDocumentAction(initial, formData);
      setState(result);
      if (result.success) {
        form.reset();
      }
    } catch (error) {
      setState({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Could not upload that file. Try a smaller JPEG or PDF.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert variant={state.success ? 'success' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="jamiyaId" value={jamiyaId} />
        <input type="hidden" name="slug" value={slug} />
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">Registration number (optional)</Label>
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={registrationNumber ?? ''}
            placeholder="e.g. society / self-help group number"
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="documentType">Document type</Label>
          <select
            id="documentType"
            name="documentType"
            required
            className="flex h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-base sm:h-10 sm:text-sm"
            defaultValue="certificate_of_registration"
          >
            {DOCUMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">
            Photo or PDF (phone photos compress automatically · max ~10MB)
          </Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? 'Preparing & uploading…' : 'Upload circle KYC'}
        </Button>
      </form>
    </div>
  );
}
