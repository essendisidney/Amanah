'use client';

import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, Button, Label } from '@jamiya/ui';
import { registerKycDocumentAction } from '../actions/profile-actions';
import { prepareKycUploadFile } from '../lib/prepare-kyc-file';
import { initialProfileActionState, type ProfileActionState } from '../lib/state';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';

export function KycUploadForm({ labels }: { labels: Dictionary['profile'] }) {
  const [state, setState] = useState<ProfileActionState>(initialProfileActionState);
  const [pending, setPending] = useState(false);

  const documentTypes = [
    { value: 'national_id', label: labels.nationalId },
    { value: 'passport', label: labels.passport },
    { value: 'driving_license', label: labels.drivingLicense },
    { value: 'proof_of_address', label: labels.proofOfAddress },
    { value: 'selfie', label: labels.selfie },
    { value: 'other', label: labels.other },
  ] as const;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const documentType = String(formData.get('documentType') ?? '');
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      setState({ success: false, message: 'Choose a file to upload.' });
      return;
    }

    setPending(true);
    setState(initialProfileActionState);
    try {
      const prepared = await prepareKycUploadFile(file);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ success: false, message: 'Authentication required.' });
        return;
      }

      const documentId = crypto.randomUUID();
      const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'id.jpg';
      const storagePath = `${user.id}/${documentId}/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(storagePath, prepared, {
          contentType: prepared.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        setState({ success: false, message: uploadError.message });
        return;
      }

      const registerData = new FormData();
      registerData.set('documentId', documentId);
      registerData.set('documentType', documentType);
      registerData.set('storagePath', storagePath);
      registerData.set('fileName', prepared.name);
      registerData.set('mimeType', prepared.type || 'image/jpeg');
      registerData.set('fileSizeBytes', String(prepared.size));

      const result = await registerKycDocumentAction(
        initialProfileActionState,
        registerData,
      );
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
            : 'Could not upload that ID. Try a smaller JPEG photo.',
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
        <div className="space-y-2">
          <Label htmlFor="documentType">{labels.documentType}</Label>
          <select
            id="documentType"
            name="documentType"
            required
            className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            defaultValue="national_id"
          >
            {documentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">{labels.fileHint}</Label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="image/*,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.pdf"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? labels.uploading : labels.uploadDocument}
        </Button>
      </form>
    </div>
  );
}
