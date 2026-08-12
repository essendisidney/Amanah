export type Dictionary = {
  langName: string;
  brand: {
    tagline: string;
    description: string;
  };
  common: {
    sadaka: string;
    signIn: string;
    getStarted: string;
    signOut: string;
    support: string;
    notifications: string;
    admin: string;
    language: string;
  };
  nav: {
    dashboard: string;
    dashboardShort: string;
    circles: string;
    circlesShort: string;
    wallet: string;
    walletShort: string;
    finance: string;
    financeShort: string;
    profile: string;
    profileShort: string;
  };
  landing: {
    startWithPhone: string;
    joinCircle: string;
    preferEmail: string;
    createAccount: string;
  };
  phoneAuth: {
    phoneLabel: string;
    phoneHint: string;
    sendOtp: string;
    sending: string;
    resendIn: string;
    codeLabel: string;
    sentTo: string;
    verify: string;
    verifying: string;
    invalidPhone: string;
    sendFailed: string;
    codeSent: string;
    changeNumber: string;
    useEmail: string;
    preferEmail: string;
    signInPassword: string;
    createEmailAccount: string;
  };
  loans: {
    title: string;
    intro: string;
    capPrefix: string;
    purpose: string;
    amount: string;
    installments: string;
    guarantorsLabel: string;
    guarantorsHint: string;
    requestLoan: string;
    guaranteeInbox: string;
    guaranteeAcceptNote: string;
    accept: string;
    decline: string;
    pendingApprovals: string;
    agreementSigned: string;
    awaitingAgreement: string;
    noGuarantors: string;
    accepted: string;
    pending: string;
    declined: string;
    approve: string;
    reject: string;
    yourLoans: string;
    remaining: string;
    noLoans: string;
    acceptAgreementHint: string;
    signerPlaceholder: string;
    acceptAgreement: string;
    repay: string;
    activeOfficer: string;
    markDefaulted: string;
  };
};

export const en: Dictionary = {
  langName: 'English',
  brand: {
    tagline: 'Trust. Community. Prosperity.',
    description:
      'Shariah-compliant digital rotating savings — save together, grow together.',
  },
  common: {
    sadaka: 'Sadaka',
    signIn: 'Sign in',
    getStarted: 'Get started',
    signOut: 'Sign out',
    support: 'Support',
    notifications: 'Notifications',
    admin: 'Admin',
    language: 'Language',
  },
  nav: {
    dashboard: 'Dashboard',
    dashboardShort: 'Home',
    circles: 'Circles',
    circlesShort: 'Circles',
    wallet: 'Wallet',
    walletShort: 'Wallet',
    finance: 'Finance',
    financeShort: 'Finance',
    profile: 'Profile',
    profileShort: 'You',
  },
  landing: {
    startWithPhone: 'Start with phone',
    joinCircle: 'Join your circle',
    preferEmail: 'Prefer email?',
    createAccount: 'Create account',
  },
  phoneAuth: {
    phoneLabel: 'Phone number',
    phoneHint: 'Kenya mobiles — 07… or +254… both work.',
    sendOtp: 'Send OTP',
    sending: 'Sending code…',
    resendIn: 'Resend in {seconds}s',
    codeLabel: 'Verification code',
    sentTo: 'Sent to {phone}',
    verify: 'Verify & continue',
    verifying: 'Verifying…',
    invalidPhone: 'Enter a valid Kenya mobile (e.g. 0712 345 678).',
    sendFailed: 'Could not send code.',
    codeSent: 'Code sent to {phone}.',
    changeNumber: 'Use a different number',
    useEmail: 'Use email instead',
    preferEmail: 'Prefer email?',
    signInPassword: 'Sign in with password',
    createEmailAccount: 'Create email account',
  },
  loans: {
    title: 'Circle loans (Qard Hassan)',
    intro:
      'Interest-free loans from the table banking pool. Optionally ask fellow members to guarantee (kafala) your request — officers wait for those accepts before approving.',
    capPrefix: 'Your request cap:',
    purpose: 'Purpose',
    amount: 'Amount ({currency})',
    installments: 'Installments',
    guarantorsLabel: 'Ask members to guarantee (optional)',
    guarantorsHint: 'Hold Ctrl/Cmd to select more than one. Guarantors must accept before approval.',
    requestLoan: 'Request loan',
    guaranteeInbox: 'Guarantee requests for you',
    guaranteeAcceptNote:
      'Accepting means you stand as kafala if they default (circle record + notice — no automatic wallet debit).',
    accept: 'Accept',
    decline: 'Decline',
    pendingApprovals: 'Pending approvals',
    agreementSigned: 'agreement signed',
    awaitingAgreement: 'awaiting borrower agreement',
    noGuarantors: 'no guarantors nominated',
    accepted: 'accepted',
    pending: 'pending',
    declined: 'declined',
    approve: 'Approve',
    reject: 'Reject',
    yourLoans: 'Your loans in this circle',
    remaining: 'remaining',
    noLoans: 'No loans yet in this circle.',
    acceptAgreementHint:
      'Interest-free Qard Hassan — accept the facility agreement to continue.',
    signerPlaceholder: 'Full name as signature',
    acceptAgreement: 'Accept agreement',
    repay: 'Repay',
    activeOfficer: 'Active loans (officer)',
    markDefaulted: 'Mark defaulted',
  },
};

export const sw: Dictionary = {
  langName: 'Kiswahili',
  brand: {
    tagline: 'Amani. Jamii. Ustawi.',
    description:
      'Akiba ya kidijitali inayofuata sheria za Kiislamu — okoa pamoja, kueni pamoja.',
  },
  common: {
    sadaka: 'Sadaka',
    signIn: 'Ingia',
    getStarted: 'Anza sasa',
    signOut: 'Toka',
    support: 'Msaada',
    notifications: 'Arifa',
    admin: 'Usimamizi',
    language: 'Lugha',
  },
  nav: {
    dashboard: 'Dashibodi',
    dashboardShort: 'Nyumbani',
    circles: 'Miduara',
    circlesShort: 'Miduara',
    wallet: 'Pochi',
    walletShort: 'Pochi',
    finance: 'Fedha',
    financeShort: 'Fedha',
    profile: 'Wasifu',
    profileShort: 'Wewe',
  },
  landing: {
    startWithPhone: 'Anza kwa simu',
    joinCircle: 'Jiunge na mduara wako',
    preferEmail: 'Unapendelea barua pepe?',
    createAccount: 'Fungua akaunti',
  },
  phoneAuth: {
    phoneLabel: 'Nambari ya simu',
    phoneHint: 'Simu za Kenya — 07… au +254… zote zinafaa.',
    sendOtp: 'Tuma OTP',
    sending: 'Inatuma msimbo…',
    resendIn: 'Tuma tena baada ya {seconds}s',
    codeLabel: 'Msimbo wa uthibitisho',
    sentTo: 'Imetumwa kwa {phone}',
    verify: 'Thibitisha na endelea',
    verifying: 'Inathibitisha…',
    invalidPhone: 'Weka simu sahihi ya Kenya (mf. 0712 345 678).',
    sendFailed: 'Imeshindikana kutuma msimbo.',
    codeSent: 'Msimbo umetumwa kwa {phone}.',
    changeNumber: 'Tumia nambari nyingine',
    useEmail: 'Tumia barua pepe badala yake',
    preferEmail: 'Unapendelea barua pepe?',
    signInPassword: 'Ingia kwa nenosiri',
    createEmailAccount: 'Fungua akaunti ya barua pepe',
  },
  loans: {
    title: 'Mikopo ya mduara (Qard Hassan)',
    intro:
      'Mikopo bila riba kutoka hazina ya meja. Unaweza kuuliza wanachama wenzako kukuhakikishia (kafala) — maofisa wanasubiri makubaliano hayo kabla ya kuidhinisha.',
    capPrefix: 'Kikomo chako cha ombi:',
    purpose: 'Madhumuni',
    amount: 'Kiasi ({currency})',
    installments: 'Malipo ya awamu',
    guarantorsLabel: 'Waombe wanachama kukuhakikishia (si lazima)',
    guarantorsHint:
      'Shikilia Ctrl/Cmd kuchagua zaidi ya mmoja. Wahakikishaji lazima wakubali kabla ya idhini.',
    requestLoan: 'Omba mkopo',
    guaranteeInbox: 'Maombi ya kafala kwako',
    guaranteeAcceptNote:
      'Kukubali kunamaanisha unasimama kafala ikiwa wameshindwa kulipa (rekodi ya mduara + arifa — hakuna kutoa pesa kiotomatiki kwenye pochi).',
    accept: 'Kubali',
    decline: 'Kataa',
    pendingApprovals: 'Zinazosubiri idhini',
    agreementSigned: 'makubaliano yamesainiwa',
    awaitingAgreement: 'inasubiri makubaliano ya mkopaji',
    noGuarantors: 'hakuna wahakikishaji waliochaguliwa',
    accepted: 'wamekubali',
    pending: 'inasubiri',
    declined: 'wamekataa',
    approve: 'Idhinisha',
    reject: 'Kataa',
    yourLoans: 'Mikopo yako katika mduara huu',
    remaining: 'iliyobaki',
    noLoans: 'Bado hakuna mikopo katika mduara huu.',
    acceptAgreementHint:
      'Qard Hassan bila riba — kubali makubaliano ya kituo ili kuendelea.',
    signerPlaceholder: 'Jina kamili kama sahihi',
    acceptAgreement: 'Kubali makubaliano',
    repay: 'Lipa',
    activeOfficer: 'Mikopo hai (ofisa)',
    markDefaulted: 'Weka kama imeshindwa',
  },
};

export const dictionaries = { en, sw } as const;

export function t(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
