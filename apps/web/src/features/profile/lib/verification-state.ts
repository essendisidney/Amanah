/**
 * Single authoritative member verification state for profile UI.
 * Derived from profiles.kyc_status, document rows, and IPRS (incl. simulated).
 */

export type VerificationState =
  | 'not_started'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'simulated';

export type VerificationDoc = {
  status: string;
};

export type VerificationInput = {
  kycStatus: string | null | undefined;
  docs: VerificationDoc[];
  /** Latest IPRS provider from iprs_verifications, e.g. "simulated" | "http" */
  iprsProvider?: string | null;
  /** profiles.iprs_status */
  iprsStatus?: string | null;
};

export type VerificationView = {
  state: VerificationState;
  /** Short badge label */
  label: string;
  /** One-line explanation */
  detail: string;
  /** Primary CTA */
  nextAction: string;
  nextHref: '#kyc-documents' | '#personal-details' | '/profile#kyc-documents';
  /** Setup checklist: counts as complete only for live approved */
  setupComplete: boolean;
};

function normalizeKyc(raw: string | null | undefined): string {
  return (raw ?? 'not_started').trim().toLowerCase();
}

/**
 * Prefer live KYC enum. Simulated IPRS must never present as live approved.
 */
export function resolveVerificationState(input: VerificationInput): VerificationView {
  const kyc = normalizeKyc(input.kycStatus);
  const docs = input.docs ?? [];
  const hasDoc = docs.length > 0;
  const hasRejectedDoc = docs.some((d) => d.status === 'rejected');
  const hasPendingDoc = docs.some((d) =>
    ['uploaded', 'pending', 'under_review'].includes(d.status),
  );
  const simulatedIprs =
    (input.iprsProvider ?? '').toLowerCase() === 'simulated' ||
    (input.iprsStatus ?? '').toLowerCase() === 'matched_demo';

  // Simulated path wins over a falsely auto-approved kyc_status
  if (simulatedIprs && kyc === 'approved') {
    return {
      state: 'simulated',
      label: 'Demo verification',
      detail:
        'IPRS ran in demo mode. This is not live government verification and does not count as approved KYC.',
      nextAction: 'Upload ID for real review, or wait for live IPRS',
      nextHref: '#kyc-documents',
      setupComplete: false,
    };
  }

  if (kyc === 'approved' && !simulatedIprs) {
    return {
      state: 'approved',
      label: 'KYC approved',
      detail: 'Identity verification is approved.',
      nextAction: 'No action needed',
      nextHref: '#kyc-documents',
      setupComplete: true,
    };
  }

  if (kyc === 'rejected' || (hasRejectedDoc && !hasPendingDoc && kyc !== 'under_review' && kyc !== 'pending')) {
    return {
      state: 'rejected',
      label: 'Verification rejected',
      detail: 'Your documents need another upload or correction.',
      nextAction: 'Upload a new ID document',
      nextHref: '#kyc-documents',
      setupComplete: false,
    };
  }

  if (
    kyc === 'under_review' ||
    kyc === 'pending' ||
    hasPendingDoc ||
    (hasDoc && kyc !== 'approved')
  ) {
    return {
      state: 'pending_review',
      label: 'Under review',
      detail: hasDoc
        ? 'Documents received — waiting for review.'
        : 'Verification is in progress.',
      nextAction: 'Check back here for updates',
      nextHref: '#kyc-documents',
      setupComplete: false,
    };
  }

  if (simulatedIprs) {
    return {
      state: 'simulated',
      label: 'Demo verification',
      detail:
        'A demo IPRS check ran. Upload ID documents for real KYC review.',
      nextAction: 'Upload ID for review',
      nextHref: '#kyc-documents',
      setupComplete: false,
    };
  }

  return {
    state: 'not_started',
    label: 'Not started',
    detail: 'Upload a national ID or passport to begin verification.',
    nextAction: 'Start verification',
    nextHref: '#kyc-documents',
    setupComplete: false,
  };
}
