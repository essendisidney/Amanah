'use client';

import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, Button, Input, Label, NativeSelect, Textarea } from '@jamiya/ui';
import { createClient } from '@/lib/supabase/client';
import { saveCircleRecordAction } from '../actions/record-actions';
import { friendlyError } from '@/lib/friendly-error';

const FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** The secretary, chair or circle admin writes minutes or a resolution, with an optional file. */
export function CircleRecordForm({
  jamiyaId,
  slug,
  meetings,
}: {
  jamiyaId: string;
  slug: string;
  meetings: Array<{ id: string; label: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    formData.set('publish', submitter?.value === 'publish' ? '1' : '0');

    const file = formData.get('file');
    formData.delete('file');
    setPending(true);
    try {
      if (file instanceof File && file.size > 0) {
        if (!FILE_TYPES.includes(file.type)) {
          setError('Attach a PDF, photo (JPEG, PNG, WebP) or Word file.');
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError('Files can be up to 10 MB.');
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
        const path = `${jamiyaId}/${crypto.randomUUID()}/${safeName}`;
        const { error: uploadError } = await createClient()
          .storage.from('circle-records')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          setError(
            uploadError.message.includes('row-level security')
              ? 'Only the secretary, chair or circle admin can attach files.'
              : friendlyError(uploadError.message),
          );
          return;
        }
        formData.set('filePath', path);
        formData.set('fileName', file.name);
        formData.set('mimeType', file.type);
      }
      await saveCircleRecordAction(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="jameiyah-surface space-y-4 px-5 py-5">
      <h2 className="text-lg font-semibold">Add minutes or a resolution</h2>
      <input type="hidden" name="jamiyaId" value={jamiyaId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="kind">Type</Label>
          <NativeSelect
            id="kind"
            name="kind"
            defaultValue="minutes"
            className="h-11"
          >
            <option value="minutes">Meeting minutes</option>
            <option value="resolution">Resolution</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="recordDate">Date</Label>
          <Input id="recordDate" name="recordDate" type="date" className="h-11" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required minLength={3} maxLength={200} placeholder="March monthly meeting" />
        </div>
        {meetings.length > 0 ? (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="meetingId">Meeting (optional)</Label>
            <NativeSelect
              id="meetingId"
              name="meetingId"
              defaultValue=""
              className="h-11"
            >
              <option value="">Not linked to a meeting</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="body">Text</Label>
        <Textarea
          id="body"
          name="body"
          rows={8}
          maxLength={20000}
          placeholder="Present, apologies, matters discussed, what was agreed and who will act."
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file">Signed copy (optional)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" />
        <p className="text-xs text-muted-foreground">PDF, photo or Word file, up to 10 MB.</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="publish" disabled={pending}>
          {pending ? 'Saving…' : 'Publish to members'}
        </Button>
        <Button type="submit" value="draft" variant="outline" disabled={pending}>
          Save as draft
        </Button>
      </div>
    </form>
  );
}
