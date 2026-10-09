'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@jamiya/shared';
import { Alert, AlertDescription, Button } from '@jamiya/ui';
import { castTermsVoteAction } from '../actions/circle-terms-vote-actions';
import { diffCircleTerms, type CircleTermsProposal } from '../lib/circle-terms';

/** Members vote on a proposed fee change, or see one that was approved and is coming. */
export function TermsVoteCard({
  proposal,
  slug,
}: {
  proposal: CircleTermsProposal;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const money = (n: number) => formatCurrency(n, proposal.terms_after.currency);
  const changes = diffCircleTerms(proposal.terms_before, proposal.terms_after, money);

  const vote = (yes: boolean) => {
    setMessage(null);
    startTransition(async () => {
      const result = await castTermsVoteAction(proposal.id, yes, slug);
      setMessage({ ok: result.success, text: result.message ?? '' });
      router.refresh();
    });
  };

  return (
    <section className="jameiyah-surface space-y-4 px-5 py-5">
      <div>
        <h2 className="text-lg font-semibold">
          {proposal.status === 'open' ? 'Vote: proposed fee change' : 'Fee change approved'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {proposal.status === 'open'
            ? `Voting closes on ${formatDate(proposal.voting_closes_at)}. It needs ${proposal.quorum} of ${proposal.eligible_voters} members to vote, and more yes than no.`
            : `Takes effect on ${proposal.effective_at ? formatDate(proposal.effective_at) : 'soon'}. You keep your current terms until you accept the new ones.`}
        </p>
      </div>

      <ul className="space-y-1 text-sm">
        {changes.map((c) => (
          <li key={c.label}>
            <span className="font-medium">{c.label}:</span> {c.before} → {c.after}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <span className="font-medium">Why:</span> {proposal.reason}
      </p>
      <p className="text-sm text-muted-foreground">
        {proposal.yes_votes} yes · {proposal.no_votes} no so far
        {proposal.my_vote != null ? ` · you voted ${proposal.my_vote ? 'yes' : 'no'}` : ''}
      </p>

      {message ? (
        <Alert variant={message.ok ? 'success' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {proposal.can_vote ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={pending} onClick={() => vote(true)}>
            {proposal.my_vote === true ? 'Yes (your vote)' : 'Vote yes'}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => vote(false)}>
            {proposal.my_vote === false ? 'No (your vote)' : 'Vote no'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
