'use client';

import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, Button, Input, Label } from '@jamiya/ui';
import { registerInstitutionAction } from '@/features/charity/actions';
import { createClient } from '@/lib/supabase/client';

/**
 * Institution registration with optional secure file upload to sadaka-media.
 * Falls back to a pasted URL when upload is unavailable.
 */
export function InstitutionRegisterForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get('registrationFile');

    setPending(true);
    setMessage(null);
    setOk(false);

    try {
      let docUrl = String(formData.get('registrationDocUrl') ?? '').trim();

      if (file instanceof File && file.size > 0) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setMessage('Sign in to upload documents.');
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'registration.pdf';
        const path = `institutions/${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('sadaka-media')
          .upload(path, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        if (uploadError) {
          setMessage(uploadError.message);
          return;
        }
        const { data } = supabase.storage.from('sadaka-media').getPublicUrl(path);
        docUrl = data.publicUrl;
        formData.set('registrationDocUrl', docUrl);
      }

      if (!docUrl) {
        setMessage('Upload a registration document or paste a secure document URL.');
        return;
      }

      const result = await registerInstitutionAction(formData);
      setOk(Boolean(result.success));
      setMessage(result.message);
      if (result.success) form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <Label htmlFor="name">Institution name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          defaultValue="mosque"
        >
          <option value="mosque">Mosque</option>
          <option value="madrasa">Madrasa</option>
          <option value="orphanage">Orphanage</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactPerson">Contact person</Label>
        <Input id="contactPerson" name="contactPerson" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="contactPhone">Phone</Label>
        <Input id="contactPhone" name="contactPhone" type="tel" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="registrationFile">Registration documents (upload)</Label>
        <Input
          id="registrationFile"
          name="registrationFile"
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="cursor-pointer file:mr-3"
        />
        <p className="text-xs text-muted-foreground">
          Prefer a signed PDF or clear photos of registration papers. Files go to secure app storage.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="registrationDocUrl">Or paste a document URL</Label>
        <Input
          id="registrationDocUrl"
          name="registrationDocUrl"
          type="url"
          placeholder="https://…"
        />
      </div>
      {message ? (
        <Alert variant={ok ? 'default' : 'destructive'}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit for verification'}
      </Button>
    </form>
  );
}
