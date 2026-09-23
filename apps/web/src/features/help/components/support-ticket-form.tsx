'use client';

import { useActionState } from 'react';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  submitSupportTicketAction,
  type SupportTicketState,
} from '../actions/support-ticket-actions';

const initial: SupportTicketState = { success: false, message: '' };

export function SupportTicketForm({
  labels,
  hideTitle = false,
}: {
  labels: {
    ticketTitle: string;
    ticketBody: string;
    subjectLabel: string;
    messageLabel: string;
    submit: string;
    submitting: string;
  };
  /** When the page already renders the section heading. */
  hideTitle?: boolean;
}) {
  const [state, action, pending] = useActionState(submitSupportTicketAction, initial);

  return (
    <form action={action} className="space-y-3.5">
      {!hideTitle ? (
        <div>
          <h2 className="text-sm font-semibold text-foreground">{labels.ticketTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{labels.ticketBody}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{labels.ticketBody}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="support-subject">{labels.subjectLabel}</Label>
        <Input
          id="support-subject"
          name="subject"
          required
          minLength={3}
          maxLength={200}
          className="h-11 text-base sm:h-10 sm:text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-body">{labels.messageLabel}</Label>
        <Textarea
          id="support-body"
          name="body"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          className="text-base sm:text-sm"
        />
      </div>
      {state.message ? (
        <p className={state.success ? 'text-sm text-primary' : 'text-sm text-destructive'}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
