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
    signOutHint: string;
    support: string;
    notifications: string;
    admin: string;
    language: string;
    viewAll: string;
    createCircle: string;
    backToDashboard: string;
    home: string;
    members: string;
    cycle: string;
    starts: string;
    perCycle: string;
    pay: string;
    left: string;
  };
  nav: {
    dashboard: string;
    dashboardShort: string;
    circles: string;
    circlesShort: string;
    wallet: string;
    walletShort: string;
    pay: string;
    payShort: string;
    finance: string;
    financeShort: string;
    activity: string;
    activityShort: string;
    profile: string;
    profileShort: string;
  };
  landing: {
    startWithPhone: string;
    joinCircle: string;
    preferEmail: string;
    createAccount: string;
    shariaEyebrow: string;
    shariaTitle: string;
    shariaLead: string;
    shariaNoRibaTitle: string;
    shariaNoRibaBody: string;
    shariaMutualTitle: string;
    shariaMutualBody: string;
    shariaGivingTitle: string;
    shariaGivingBody: string;
    shariaDisclaimer: string;
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
    codeAlreadyUsed: string;
    invalidOrExpired: string;
    networkError: string;
    verifyFallback: string;
    inviteNextHint: string;
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
  dashboard: {
    eyebrow: string;
    greeting: string;
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    nameFallback: string;
    subtitle: string;
    completeProfileHint: string;
    signedInAs: string;
    createCircle: string;
    myCircles: string;
    completeProfile: string;
    activeCircles: string;
    membershipsHint: string;
    membershipsHintOne: string;
    pendingContributions: string;
    dueOrOverdue: string;
    upcomingPayouts: string;
    scheduledForYou: string;
    wallet: string;
    available: string;
    availableHint: string;
    noWalletYet: string;
    contributionsTitle: string;
    contributionsDesc: string;
    contributionsEmptyTitle: string;
    contributionsEmptyDesc: string;
    cycleDue: string;
    paid: string;
    amountPlaceholder: string;
    myCirclesTitle: string;
    myCirclesDesc: string;
    noCirclesTitle: string;
    noCirclesDesc: string;
    createACircle: string;
    position: string;
    payoutsTitle: string;
    payoutsDesc: string;
    payoutsEmptyTitle: string;
    payoutsEmptyDesc: string;
    cycleScheduled: string;
    notificationsTitle: string;
    unread: string;
    notificationsDesc: string;
    notificationsEmptyTitle: string;
    notificationsEmptyDesc: string;
    quickAdd: string;
    quickPayDue: string;
    quickCircles: string;
    quickWithdraw: string;
    quickMoney: string;
    quickPay: string;
    duePrefix: string;
    recent: string;
    activity: string;
    nothingYet: string;
    addPhone: string;
    addMoneyToPay: string;
  };
  paySheet: {
    title: string;
    subtitle: string;
    addMoney: string;
    addMoneyHint: string;
    withdraw: string;
    withdrawHint: string;
    payCircle: string;
    payCircleHint: string;
    payDue: string;
    payDueHint: string;
    goals: string;
    goalsHint: string;
    close: string;
    balanceLabel: string;
    openMoney: string;
    openMoneyHint: string;
    sectionPay: string;
    sectionSee: string;
    sectionGrow: string;
    sectionGive: string;
    moreTools: string;
    overdue: string;
    insights: string;
    insightsHint: string;
    qard: string;
    qardHint: string;
    welfare: string;
    welfareHint: string;
    invest: string;
    investHint: string;
    tawarruq: string;
    tawarruqHint: string;
    sadaka: string;
    sadakaHint: string;
    zakat: string;
    zakatHint: string;
    allFinance: string;
    allFinanceHint: string;
  };
  contributionCard: {
    nextTitle: string;
    moneyAvailable: string;
    due: string;
    overdue: string;
    payAheadAvailable: string;
    alreadyPaid: string;
    needWallet: string;
    needMore: string;
    paysFromBalance: string;
    amountOptional: string;
    pay: string;
    payAhead: string;
    addMoney: string;
    addMoneyToPay: string;
    partialAmount: string;
    payPartial: string;
    calendar: string;
  };
  circles: {
    eyebrow: string;
    title: string;
    subtitle: string;
    createCircle: string;
    emptyTitle: string;
    emptyDesc: string;
    createACircle: string;
    redeemTitle: string;
    redeemHint: string;
    redeemPlaceholder: string;
    redeemSubmit: string;
    redeemWorking: string;
    redeemInvalid: string;
  };
  wallet: {
    eyebrow: string;
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDesc: string;
    totalBalance: string;
    topUp: string;
    withdraw: string;
    paymentsInProgress: string;
    pendingPaystackHint: string;
    failedPayments: string;
    historyTitle: string;
    historyEmpty: string;
    availableLabel: string;
    quickSave: string;
    quickInsights: string;
    moreTitle: string;
    moreDesc: string;
    moreGoals: string;
    moreGoalsDesc: string;
    moreQard: string;
    moreQardDesc: string;
    moreSadakaDesc: string;
    moreZakat: string;
    moreZakatDesc: string;
    phoneBannerTitle: string;
    phoneBannerBody: string;
    addPhone: string;
    payContributionCta: string;
    memberMoney: string;
  };
  walletForms: {
    amount: string;
    mpesaPhone: string;
    paystackHint: string;
    paystackReturnHint: string;
    bankHint: string;
    simulatedHint: string;
    processing: string;
    payMpesa: string;
    payPaystack: string;
    startBank: string;
    topUpWallet: string;
    bank: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    submitting: string;
    requestWithdrawal: string;
    retry: string;
    retrying: string;
    checkStatus: string;
    checkingStatus: string;
    stepUpHint: string;
    verificationCode: string;
    sendCode: string;
    confirmWithCode: string;
  };
  finance: {
    eyebrow: string;
    title: string;
    subtitle: string;
    moneyAvailable: string;
    openDuesOne: string;
    openDuesMany: string;
    noOpenDues: string;
    addMoney: string;
    payDues: string;
    goalsCta: string;
    insightsTitle: string;
    insightsDesc: string;
    shariaCta: string;
    welfareTitle: string;
    welfareDesc: string;
    qardTitle: string;
    qardDesc: string;
    tawarruqTitle: string;
    tawarruqDesc: string;
    goalsTitle: string;
    goalsDesc: string;
    investTitle: string;
    investDesc: string;
    investSharesTitle: string;
    investSharesBody: string;
    investSharesCta: string;
    investSharesJoinCta: string;
    investTreasuryTitle: string;
    investTreasuryBody: string;
    investTreasuryCta: string;
    investTreasuryBrowseCta: string;
    investTawarruqTitle: string;
    investTawarruqBody: string;
    investTawarruqCta: string;
    investYourCircles: string;
    investEmptyTitle: string;
    investEmptyDesc: string;
    investEmptyCta: string;
    backToFinance: string;
    shariaTitle: string;
    shariaLead: string;
    welfareOverview: string;
    circleFallback: string;
    noWelfare: string;
  };
  profile: {
    eyebrow: string;
    title: string;
    subtitle: string;
    youFallback: string;
    amanahScore: string;
    scoreExcellent: string;
    scoreStrong: string;
    scoreBuilding: string;
    appearance: string;
    linkMoney: string;
    linkGoals: string;
    linkVerification: string;
    linkZakat: string;
    linkSupport: string;
    onboardingEyebrow: string;
    onboardingTitle: string;
    onboardingBody: string;
    onboardingStepName: string;
    onboardingStepPhone: string;
    onboardingStepKyc: string;
    onboardingHome: string;
    onboardingAddName: string;
    onboardingAddPhone: string;
    onboardingVerification: string;
    personalDetails: string;
    email: string;
    mpesaLinkage: string;
    kycDocuments: string;
    uploadedFiles: string;
    noDocuments: string;
    fullName: string;
    phone: string;
    countryCode: string;
    bio: string;
    saving: string;
    saveProfile: string;
    mpesaNumber: string;
    mpesaHint: string;
    linking: string;
    linkMpesa: string;
    documentType: string;
    fileHint: string;
    uploading: string;
    uploadDocument: string;
    nationalId: string;
    passport: string;
    drivingLicense: string;
    proofOfAddress: string;
    selfie: string;
    other: string;
    referrals: string;
    yourReferralCode: string;
    copyCode: string;
    applySomeoneCode: string;
    applying: string;
    apply: string;
    referralHint: string;
  };
  notificationsPage: {
    eyebrow: string;
    title: string;
    unreadOne: string;
    unreadMany: string;
    upToDate: string;
    markAllRead: string;
    markRead: string;
    emptyTitle: string;
    emptyDesc: string;
    recentMoney: string;
    openMoney: string;
    openCircles: string;
    openItem: string;
  };
  support: {
    eyebrow: string;
    title: string;
    body: string;
    tipLabel: string;
    phoneOptional: string;
    submit: string;
  };
  circle: {
    meetingsChat: string;
    elections: string;
    circleKyc: string;
    treasury: string;
    shares: string;
    journal: string;
    invoices: string;
    myStatement: string;
    idReport: string;
    officerConsole: string;
    contribution: string;
    members: string;
    cycle: string;
    frequency: string;
    everyDays: string;
    startDate: string;
    notSet: string;
    creditSnapshot: string;
    womensCircle: string;
    bodaStage: string;
    womensBlurb: string;
    bodaBlurb: string;
    arrears: string;
    auditTrail: string;
    downloadPdf: string;
  };
  officer: {
    title: string;
    auditEyebrow: string;
    auditIntro: string;
    dualApprovalTrail: string;
    noDualRequests: string;
    treasuryChanges: string;
    noTreasuryAudit: string;
    allCircleAudit: string;
    arrearsEyebrow: string;
    arrearsIntro: string;
    bucketCurrent: string;
    bucket17: string;
    bucket830: string;
    bucket3160: string;
    bucket61: string;
    bucketTotal: string;
    autoFineTitle: string;
    autoFineIntro: string;
    autoFineEnable: string;
    graceDays: string;
    saveAutoFine: string;
    runAutoFinesNow: string;
    memberArrears: string;
    noArrears: string;
    openItems: string;
    overdue: string;
    qardQueue: string;
    noPendingQard: string;
    kafalaPending: string;
    approveLoan: string;
    rejectLoan: string;
  };
  admin: {
    sadakaTitle: string;
    shariaBoardPanel: string;
    shariaBoardHint: string;
    decisionRefRequired: string;
    auditTitle: string;
  };
  install: {
    title: string;
    detailNative: string;
    detailIos: string;
    detailAndroid: string;
    install: string;
    opening: string;
    notNow: string;
  };
  errors: {
    title: string;
    body: string;
    tryAgain: string;
  };
};

export const en: Dictionary = {
  langName: 'English',
  brand: {
    tagline: 'Your money. Your people. Your Amanah.',
    description:
      'Save, contribute and grow together through trusted financial circles — the operating system for community finance.',
  },
  common: {
    sadaka: 'Sadaka',
    signIn: 'Sign in',
    getStarted: 'Sign in',
    signOut: 'Sign out',
    signOutHint: 'End your session on this phone.',
    support: 'Support',
    notifications: 'Notifications',
    admin: 'Admin',
    language: 'Language',
    viewAll: 'All',
    createCircle: 'Create circle',
    backToDashboard: 'Home',
    home: 'Home',
    members: 'members',
    cycle: 'Cycle',
    starts: 'Starts',
    perCycle: 'per cycle',
    pay: 'Pay',
    left: 'left',
  },
  nav: {
    dashboard: 'Home',
    dashboardShort: 'Home',
    circles: 'Circles',
    circlesShort: 'Circles',
    wallet: 'Money',
    walletShort: 'Money',
    pay: 'Pay',
    payShort: 'Pay',
    finance: 'Finance',
    financeShort: 'Finance',
    activity: 'Activity',
    activityShort: 'Activity',
    profile: 'You',
    profileShort: 'You',
  },
  landing: {
    startWithPhone: 'Sign in with phone',
    joinCircle: 'How Amanah works',
    preferEmail: 'Prefer email?',
    createAccount: 'Create account',
    shariaEyebrow: 'Shariah',
    shariaTitle: 'How Amanah stays Shariah-conscious',
    shariaLead:
      'Amanah is built for communities that want money tools without riba at the centre — with clear records and mutual support.',
    shariaNoRibaTitle: 'No interest in your circles',
    shariaNoRibaBody:
      'Circle contributions, payouts, and Qard Hassan are designed without charging interest between members.',
    shariaMutualTitle: 'Mutual aid & transparency',
    shariaMutualBody:
      'Welfare funds, dual approval, and audit trails keep shared money visible and accountable.',
    shariaGivingTitle: 'Giving that fits faith practice',
    shariaGivingBody:
      'Sadaka campaigns and a Zakat calculator sit alongside savings goals for Hajj, Umra, and Udhiyah.',
    shariaDisclaimer:
      'This is product guidance, not a fatwa. Ask a scholar you trust for personal rulings.',
  },
  phoneAuth: {
    phoneLabel: 'Phone number',
    phoneHint: 'Kenya mobiles — 07… or +254… both work.',
    sendOtp: 'Send OTP',
    sending: 'Sending code…',
    resendIn: 'Resend in {seconds}s',
    codeLabel: 'Verification code',
    sentTo: 'Sent to {phone}',
    verify: 'Verify',
    verifying: 'Verifying…',
    invalidPhone: 'Enter a valid Kenya mobile (e.g. 0712 345 678).',
    sendFailed: 'Could not send code.',
    codeSent: 'Code sent to {phone}.',
    changeNumber: 'Use a different number',
    useEmail: 'Use email instead',
    preferEmail: 'Prefer email?',
    signInPassword: 'Sign in with password',
    createEmailAccount: 'Create email account',
    codeAlreadyUsed: 'This code was already used or failed. Request a new code.',
    invalidOrExpired: 'Invalid or expired code. Request a new one.',
    networkError: 'Network error verifying code. Check connection and try again.',
    verifyFallback: 'Could not verify code. Request a new one.',
    inviteNextHint: 'After verifying, you’ll open your circle invite.',
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
  dashboard: {
    eyebrow: 'Member home',
    greeting: 'Assalamu alaikum',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    nameFallback: 'there',
    subtitle: 'Circles, dues, and payouts.',
    completeProfileHint: ' Complete your profile to unlock invitations and verification.',
    signedInAs: 'Signed in as {who}',
    createCircle: 'Create circle',
    myCircles: 'My circles',
    completeProfile: 'Complete profile',
    activeCircles: 'Active circles',
    membershipsHint: '{count} total memberships',
    membershipsHintOne: '{count} total membership',
    pendingContributions: 'Pending contributions',
    dueOrOverdue: 'Due or overdue',
    upcomingPayouts: 'Upcoming payouts',
    scheduledForYou: 'Scheduled for you',
    wallet: 'Wallet',
    available: 'Available',
    availableHint: '{currency} available',
    noWalletYet: 'No wallet yet',
    contributionsTitle: 'Upcoming contributions',
    contributionsDesc: 'Dues that are pending or late across your circles.',
    contributionsEmptyTitle: 'Nothing due right now',
    contributionsEmptyDesc:
      'When cycles open, your contribution schedule will appear here.',
    cycleDue: 'Cycle {cycle} · Due {date}',
    paid: 'Paid',
    amountPlaceholder: 'Amount (blank = full)',
    myCirclesTitle: 'My circles',
    myCirclesDesc: 'Circles you belong to as a member or circle admin.',
    noCirclesTitle: 'No circles yet',
    noCirclesDesc:
      'Create a circle or accept an invitation to start saving with your community.',
    createACircle: 'Create a circle',
    position: 'Position #{n}',
    payoutsTitle: 'Payout schedule',
    payoutsDesc: 'Your upcoming or in-progress payout turns.',
    payoutsEmptyTitle: 'No payouts scheduled',
    payoutsEmptyDesc:
      'Once the circle assigns payout order and cycles begin, your turns will show here.',
    cycleScheduled: 'Cycle {cycle} · Scheduled {date}',
    notificationsTitle: 'Notifications',
    unread: '{count} unread',
    notificationsDesc: 'Recent activity from your circles.',
    notificationsEmptyTitle: "You're all caught up",
    notificationsEmptyDesc: 'Invites, dues, and payout updates will land here.',
    quickAdd: 'Add',
    quickPayDue: 'Pay due',
    quickCircles: 'Circles',
    quickWithdraw: 'Withdraw',
    quickMoney: 'Money',
    quickPay: 'Pay',
    duePrefix: 'Due',
    recent: 'Recent',
    activity: 'Activity',
    nothingYet: 'Nothing yet',
    addPhone: 'Add phone',
    addMoneyToPay: 'Add money to pay',
  },
  paySheet: {
    title: 'Pay',
    subtitle: 'Add, settle dues, withdraw — or open any money tool from here.',
    addMoney: 'Add money',
    addMoneyHint: 'Top up your Amanah balance',
    withdraw: 'Withdraw',
    withdrawHint: 'Send to M-Pesa or bank',
    payCircle: 'Circles',
    payCircleHint: 'Open a circle to pay dues',
    payDue: 'Pay due',
    payDueHint: 'Settle your next contribution',
    goals: 'Goals',
    goalsHint: 'Hajj, Umra, and personal saves',
    close: 'Close',
    balanceLabel: 'Available',
    openMoney: 'Money',
    openMoneyHint: 'Balance, history, and top-ups',
    sectionPay: 'Pay & send',
    sectionSee: 'See & plan',
    sectionGrow: 'Borrow & grow',
    sectionGive: 'Give',
    moreTools: 'More tools',
    overdue: 'Overdue',
    insights: 'Insights',
    insightsHint: 'This month’s story and open dues',
    qard: 'Qard Hassan',
    qardHint: 'Interest-free circle loans',
    welfare: 'Welfare',
    welfareHint: 'Circle support funds',
    invest: 'Invest',
    investHint: 'Shares and partner options',
    tawarruq: 'Tawarruq',
    tawarruqHint: 'Shariah financing requests',
    sadaka: 'Sadaka',
    sadakaHint: 'Give to endorsed campaigns',
    zakat: 'Zakat',
    zakatHint: 'Estimate what you owe',
    allFinance: 'All money tools',
    allFinanceHint: 'Full Finance hub',
  },
  contributionCard: {
    nextTitle: 'Your next contribution',
    moneyAvailable: 'Money available',
    due: 'Due',
    overdue: 'overdue',
    payAheadAvailable: 'pay ahead available',
    alreadyPaid: '{amount} already paid',
    needWallet: 'Add money to your wallet, then pay this contribution.',
    needMore: 'You need about {amount} more to pay in full.',
    paysFromBalance:
      'Pays from your Amanah balance into this circle. Leave amount blank for the full remaining balance.',
    amountOptional: 'Amount (optional)',
    pay: 'Pay',
    payAhead: 'Pay ahead',
    addMoney: 'Add money',
    addMoneyToPay: 'Add money to pay',
    partialAmount: 'Partial amount',
    payPartial: 'Pay partial',
    calendar: 'Calendar',
  },
  circles: {
    eyebrow: 'Circles',
    title: 'Circles',
    subtitle: 'Your rotating savings circles.',
    createCircle: 'Create circle',
    emptyTitle: 'No circles yet',
    emptyDesc: 'Create a circle, or join with an invite code.',
    createACircle: 'Create a circle',
    redeemTitle: 'Enter invite code',
    redeemHint:
      'Paste a short invite code or the full join link from WhatsApp.',
    redeemPlaceholder: 'AB3K7M2Q or https://…/invitations/…',
    redeemSubmit: 'Join with code',
    redeemWorking: 'Opening…',
    redeemInvalid: 'Paste a 6–8 character invite code or an /invitations/… link.',
  },
  wallet: {
    eyebrow: 'Money',
    title: 'Money',
    subtitle: 'Balance, top-ups, and withdrawals.',
    emptyTitle: 'No balance yet',
    emptyDesc: 'Your wallet opens automatically with your profile.',
    totalBalance: 'Total balance {amount}',
    topUp: 'Add money',
    withdraw: 'Withdraw',
    paymentsInProgress: 'In progress',
    pendingPaystackHint:
      'Already paid? Wait a moment or check status.',
    failedPayments: 'Failed — retry',
    historyTitle: 'History',
    historyEmpty:
      'Top-ups, contributions, and payouts will appear here.',
    availableLabel: 'Available',
    quickSave: 'Save',
    quickInsights: 'Insights',
    moreTitle: 'More',
    moreDesc: 'Lending, goals, and giving.',
    moreGoals: 'Goals',
    moreGoalsDesc: 'Hajj, Umra, and personal saves',
    moreQard: 'Qard Hassan',
    moreQardDesc: 'Interest-free circle loans',
    moreSadakaDesc: 'Give to endorsed campaigns',
    moreZakat: 'Zakat',
    moreZakatDesc: 'Estimate what you owe',
    phoneBannerTitle: 'Add a Kenya mobile',
    phoneBannerBody: 'SMS and withdrawals need a +254 number on your profile.',
    addPhone: 'Add phone',
    payContributionCta: 'Pay contribution',
    memberMoney: 'Member',
  },
  walletForms: {
    amount: 'Amount ({currency})',
    mpesaPhone: 'M-Pesa phone',
    paystackHint:
      'Pay securely with M-Pesa, card, or bank. You will confirm on the next screen.',
    paystackReturnHint:
      'After payment, you return here. If the balance is slow to update, tap Check status.',
    bankHint: 'Bank top-up creates a pending request for settlement.',
    simulatedHint:
      'Instant demo credit (no M-Pesa). Use this to pay dues and test flows.',
    processing: 'Processing…',
    payMpesa: 'Pay with M-Pesa',
    payPaystack: 'Continue to pay',
    startBank: 'Start bank top-up',
    topUpWallet: 'Add money',
    bank: 'Bank',
    bankName: 'Bank name',
    accountName: 'Account name',
    accountNumber: 'Account number',
    submitting: 'Submitting…',
    requestWithdrawal: 'Request withdrawal',
    retry: 'Retry',
    retrying: 'Retrying…',
    checkStatus: 'Check status',
    checkingStatus: 'Checking…',
    stepUpHint: 'We SMS a 6-digit code to your profile phone before money moves.',
    verificationCode: 'SMS code',
    sendCode: 'Send new code',
    confirmWithCode: 'Confirm',
  },
  finance: {
    eyebrow: 'Finance',
    title: 'Finance',
    subtitle: 'Goals, welfare, and interest-free lending.',
    moneyAvailable: 'Money available',
    openDuesOne: '{count} open due · {amount} left',
    openDuesMany: '{count} open dues · {amount} left',
    noOpenDues: 'No open contribution dues',
    addMoney: 'Add money',
    payDues: 'Pay dues',
    goalsCta: 'Goals',
    insightsTitle: 'Insights',
    insightsDesc: 'This month’s inflow, on-time rate, and upcoming dues.',
    shariaCta: 'Shariah',
    welfareTitle: 'Welfare fund',
    welfareDesc: 'Medical, funeral, and accident support.',
    qardTitle: 'Qard Hassan',
    qardDesc: 'Interest-free loans from your circle.',
    tawarruqTitle: 'Tawarruq',
    tawarruqDesc: 'Partner Sharia finance.',
    goalsTitle: 'Savings goals',
    goalsDesc: 'Hajj, Umra, Udhiyah, or any target.',
    investTitle: 'Investments',
    investDesc: 'Shares, treasury projects, and partner finance.',
    investSharesTitle: 'Circle shares',
    investSharesBody:
      'Buy and hold membership shares in your circle. Officers keep par value and dividends on record.',
    investSharesCta: 'Shares',
    investSharesJoinCta: 'Join a circle first',
    investTreasuryTitle: 'Treasury projects',
    investTreasuryBody:
      'Circles record Shariah-conscious investments so members see where pooled capital goes.',
    investTreasuryCta: 'Treasury',
    investTreasuryBrowseCta: 'Circles',
    investTawarruqTitle: 'Partner Tawarruq',
    investTawarruqBody:
      'Larger finance outside the circle pool, kept separate from interest-free Qard.',
    investTawarruqCta: 'Tawarruq',
    investYourCircles: 'Your circles',
    investEmptyTitle: 'No circles yet',
    investEmptyDesc:
      'Join or create a circle for shares and treasury records.',
    investEmptyCta: 'Circles',
    backToFinance: 'Finance',
    shariaTitle: 'Shariah on Amanah',
    shariaLead:
      'Circles avoid riba between members. Qard is interest-free. Welfare and giving support mutual care. Partner Tawarruq is offered as a separate Sharia finance path — not a fatwa.',
    welfareOverview: 'Welfare overview',
    circleFallback: 'Circle',
    noWelfare: 'Your circles have no welfare funds yet.',
  },
  profile: {
    eyebrow: 'You',
    title: 'You',
    subtitle: 'Name, phone, and verification.',
    youFallback: 'You',
    amanahScore: 'Amanah Score',
    scoreExcellent: 'Excellent',
    scoreStrong: 'Strong',
    scoreBuilding: 'Building',
    appearance: 'Appearance',
    linkMoney: 'Money',
    linkGoals: 'Goals',
    linkVerification: 'Verification',
    linkZakat: 'Zakat',
    linkSupport: 'Support',
    onboardingEyebrow: 'Almost ready',
    onboardingTitle: 'Welcome to Amanah',
    onboardingBody:
      'Add your name and Kenya mobile for secure money moves. Verification is recommended before larger transfers.',
    onboardingStepName: 'Save your full name',
    onboardingStepPhone: 'Add a Kenya mobile (+254…)',
    onboardingStepKyc: 'Upload a verification document (optional)',
    onboardingHome: 'Home',
    onboardingAddName: 'Add your name',
    onboardingAddPhone: 'Add your phone',
    onboardingVerification: 'Verification',
    personalDetails: 'Personal details',
    email: 'Email: {email}',
    mpesaLinkage: 'M-Pesa',
    kycDocuments: 'Verification',
    uploadedFiles: 'Uploaded files',
    noDocuments: 'No documents uploaded yet.',
    fullName: 'Full name',
    phone: 'Phone',
    countryCode: 'Country code',
    bio: 'Bio',
    saving: 'Saving…',
    saveProfile: 'Save profile',
    mpesaNumber: 'M-Pesa number',
    mpesaHint: 'Used for STK top-ups and payout cash-out queues.',
    linking: 'Linking…',
    linkMpesa: 'Link M-Pesa',
    documentType: 'Document type',
    fileHint: 'Photo or PDF (phone photos are compressed automatically · max ~10MB)',
    uploading: 'Uploading…',
    uploadDocument: 'Upload document',
    nationalId: 'National ID',
    passport: 'Passport',
    drivingLicense: 'Driving license',
    proofOfAddress: 'Proof of address',
    selfie: 'Selfie',
    other: 'Other',
    referrals: 'Referrals',
    yourReferralCode: 'Your referral code',
    copyCode: 'Copy code',
    applySomeoneCode: 'Apply someone’s code',
    applying: 'Applying…',
    apply: 'Apply',
    referralHint:
      'Referral qualifies after your first paid contribution. Rewards are marked by admin.',
  },
  notificationsPage: {
    eyebrow: 'Activity',
    title: 'Activity',
    unreadOne: '{count} unread update',
    unreadMany: '{count} unread updates',
    upToDate: 'You are up to date.',
    markAllRead: 'Mark all as read',
    markRead: 'Mark read',
    emptyTitle: 'No activity yet',
    emptyDesc: 'Circle invites, contribution reminders, and payout updates will appear here.',
    recentMoney: 'Recent money',
    openMoney: 'Money',
    openCircles: 'Circles',
    openItem: 'Open',
  },
  support: {
    eyebrow: 'Support Amanah',
    title: 'Support Amanah',
    body: 'A voluntary tip for the platform — not sadaka, and not a charity campaign.',
    tipLabel: 'Tip (KES)',
    phoneOptional: 'Phone (optional)',
    submit: 'Send tip',
  },
  circle: {
    meetingsChat: 'Meetings & chat',
    elections: 'Elections',
    circleKyc: 'Circle KYC',
    treasury: 'Treasury',
    shares: 'Shares',
    journal: 'Journal',
    invoices: 'Invoices',
    myStatement: 'My statement',
    idReport: 'Member statement',
    officerConsole: 'Officer console',
    contribution: 'Contribution',
    members: 'Members',
    cycle: 'Cycle',
    frequency: 'Frequency',
    everyDays: 'Every {days} days',
    startDate: 'Start date',
    notSet: 'Not set',
    creditSnapshot: 'Your credit snapshot',
    womensCircle: 'Women’s circle',
    bodaStage: 'Boda / tuktuk stage',
    womensBlurb: 'Community gatekeeping and welfare support for women’s savings circles.',
    bodaBlurb: 'Stage-based savings with welfare emphasis for riders and operators.',
    arrears: 'Arrears',
    auditTrail: 'Audit trail',
    downloadPdf: 'Download PDF',
  },
  officer: {
    title: 'Officer console',
    auditEyebrow: 'Audit trail',
    auditIntro: 'Dual-approval history and treasury changes for this circle.',
    dualApprovalTrail: 'Dual-approval requests',
    noDualRequests: 'No dual-approval requests yet.',
    treasuryChanges: 'Treasury & books changes',
    noTreasuryAudit: 'No treasury audit rows yet.',
    allCircleAudit: 'All circle audit events',
    arrearsEyebrow: 'Arrears aging',
    arrearsIntro: 'Outstanding dues by age bucket, plus auto-fine schedule.',
    bucketCurrent: 'Current (not overdue)',
    bucket17: '1–7 days',
    bucket830: '8–30 days',
    bucket3160: '31–60 days',
    bucket61: '61+ days',
    bucketTotal: 'Total outstanding',
    autoFineTitle: 'Auto-fine schedule',
    autoFineIntro:
      'After the grace period, late contributions are marked late and penalties are assessed.',
    autoFineEnable: 'Enable automatic late fines',
    graceDays: 'Grace days after due date',
    saveAutoFine: 'Save auto-fine settings',
    runAutoFinesNow: 'Run auto-fines now',
    memberArrears: 'Members in arrears',
    noArrears: 'No open arrears.',
    openItems: 'open items',
    overdue: 'overdue',
    qardQueue: 'Qard & kafala queue',
    noPendingQard: 'No loans awaiting officer decision.',
    kafalaPending: 'Guarantees pending',
    approveLoan: 'Approve loan',
    rejectLoan: 'Reject',
  },
  admin: {
    sadakaTitle: 'Sadaka & Sharia fees',
    shariaBoardPanel: 'Sharia board sign-off',
    shariaBoardHint:
      'Endorsing a campaign requires a board decision reference. Unendorsed campaigns stay marked pending.',
    decisionRefRequired: 'Decision reference is required to endorse.',
    auditTitle: 'Platform audit',
  },
  install: {
    title: 'Add Amanah to your device',
    detailNative: 'Install Amanah for quick access on your phone or desktop.',
    detailIos: 'Share → Add to Home Screen for one-tap access to your circles and wallet.',
    detailAndroid:
      'Chrome may hide Install until you visit a few times. Use the menu (⋮) → Install app or Add to Home screen. Open in Chrome (not in-app browsers).',
    install: 'Install',
    opening: 'Opening…',
    notNow: 'Not now',
  },
  errors: {
    title: 'Something went wrong',
    body: 'We are retrying this page. Tap below if it does not load automatically.',
    tryAgain: 'Try again',
  },
};

export const sw: Dictionary = {
  langName: 'Kiswahili',
  brand: {
    tagline: 'Pesa yako. Watu wako. Amanah yako.',
    description:
      'Okoa, changia na kueni pamoja kupitia miduara ya fedha yenye uaminifu — mfumo wa fedha kwa jamii.',
  },
  common: {
    sadaka: 'Sadaka',
    signIn: 'Ingia',
    getStarted: 'Anza sasa',
    signOut: 'Toka',
    signOutHint: 'Maliza kikao chako kwenye simu hii.',
    support: 'Msaada',
    notifications: 'Arifa',
    admin: 'Usimamizi',
    language: 'Lugha',
    viewAll: 'Angalia zote',
    createCircle: 'Unda mduara',
    backToDashboard: 'Rudi dashibodi',
    home: 'Nyumbani',
    members: 'wanachama',
    cycle: 'Mzunguko',
    starts: 'Inaanza',
    perCycle: 'kwa mzunguko',
    pay: 'Lipa',
    left: 'imebaki',
  },
  nav: {
    dashboard: 'Nyumbani',
    dashboardShort: 'Nyumbani',
    circles: 'Miduara',
    circlesShort: 'Miduara',
    wallet: 'Pesa',
    walletShort: 'Pesa',
    pay: 'Lipa',
    payShort: 'Lipa',
    finance: 'Fedha',
    financeShort: 'Fedha',
    activity: 'Shughuli',
    activityShort: 'Shughuli',
    profile: 'Wewe',
    profileShort: 'Wewe',
  },
  landing: {
    startWithPhone: 'Anza sasa',
    joinCircle: 'Gundua Amanah',
    preferEmail: 'Unapendelea barua pepe?',
    createAccount: 'Fungua akaunti',
    shariaEyebrow: 'Shariah',
    shariaTitle: 'Jinsi Amanah inavyofuata Shariah',
    shariaLead:
      'Amanah imeundwa kwa jamii zinazotaka zana za fedha bila riba kuwa kiini — na rekodi wazi na msaada wa pamoja.',
    shariaNoRibaTitle: 'Hakuna riba katika miduara yako',
    shariaNoRibaBody:
      'Michango, malipo, na Qard Hassan zimeundwa bila kutoza riba kati ya wanachama.',
    shariaMutualTitle: 'Msaada wa pamoja na uwazi',
    shariaMutualBody:
      'Hazina za ustawi, idhini mbili, na rekodi za ukaguzi huweka fedha za pamoja wazi na zinazowajibika.',
    shariaGivingTitle: 'Kutoa kunakofaa imani',
    shariaGivingBody:
      'Kampeni za Sadaka na kikokotoo cha Zakat pamoja na malengo ya Hajj, Umra, na Udhiyah.',
    shariaDisclaimer:
      'Hii ni mwongozo wa bidhaa, si fatwa. Uliza msomi unayemwamini kwa hukumu binafsi.',
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
    codeAlreadyUsed: 'Msimbo huu umetumika au umeshindikana. Omba msimbo mpya.',
    invalidOrExpired: 'Msimbo si sahihi au umeisha muda. Omba mpya.',
    networkError: 'Hitilafu ya mtandao wakati wa kuthibitisha. Angalia muunganisho.',
    verifyFallback: 'Imeshindikana kuthibitisha msimbo. Omba mpya.',
    inviteNextHint: 'Baada ya kuthibitisha, utafungua mwaliko wa mduara.',
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
  dashboard: {
    eyebrow: 'Nyumbani kwa mwanachama',
    greeting: 'Assalamu alaikum',
    greetingMorning: 'Habari za asubuhi',
    greetingAfternoon: 'Habari za mchana',
    greetingEvening: 'Habari za jioni',
    nameFallback: 'rafiki',
    subtitle: 'Fuatilia miduara, michango, na zamu za malipo.',
    completeProfileHint: ' Kamilisha wasifu wako ili kufungua mialiko na KYC.',
    signedInAs: 'Umeingia kama {who}',
    createCircle: 'Unda mduara',
    myCircles: 'Miduara yangu',
    completeProfile: 'Kamilisha wasifu',
    activeCircles: 'Miduara hai',
    membershipsHint: 'Uanachama {count} kwa jumla',
    membershipsHintOne: 'Uanachama {count} kwa jumla',
    pendingContributions: 'Michango inayosubiri',
    dueOrOverdue: 'Iliyofika au imechelewa',
    upcomingPayouts: 'Malipo yanayokuja',
    scheduledForYou: 'Yaliyoratibiwa kwako',
    wallet: 'Pochi',
    available: 'Inayopatikana',
    availableHint: '{currency} inayopatikana',
    noWalletYet: 'Bado hakuna pochi',
    contributionsTitle: 'Michango inayokuja',
    contributionsDesc: 'Michango inayosubiri au iliyochelewa katika miduara yako.',
    contributionsEmptyTitle: 'Hakuna kinachodaiwa sasa',
    contributionsEmptyDesc:
      'Mizunguko ikifunguliwa, ratiba yako ya michango itaonekana hapa.',
    cycleDue: 'Mzunguko {cycle} · Inadaiwa {date}',
    paid: 'Imelipwa',
    amountPlaceholder: 'Kiasi (tupu = kamili)',
    myCirclesTitle: 'Miduara yangu',
    myCirclesDesc: 'Miduara uliyojiunga kama mwanachama au msimamizi.',
    noCirclesTitle: 'Bado hakuna miduara',
    noCirclesDesc:
      'Unda mduara au kubali mwaliko ili kuanza kuokoa na jamii yako.',
    createACircle: 'Unda mduara',
    position: 'Nafasi #{n}',
    payoutsTitle: 'Ratiba ya malipo',
    payoutsDesc: 'Zamu zako za malipo zinazokuja au zinazoendelea.',
    payoutsEmptyTitle: 'Hakuna malipo yaliyoratibiwa',
    payoutsEmptyDesc:
      'Mduara ukipanga mpangilio wa malipo na mizunguko kuanza, zamu zako zitaonekana hapa.',
    cycleScheduled: 'Mzunguko {cycle} · Imepangwa {date}',
    notificationsTitle: 'Arifa',
    unread: '{count} hazijasomwa',
    notificationsDesc: 'Shughuli za hivi karibuni kutoka miduara yako.',
    notificationsEmptyTitle: 'Umesoma zote',
    notificationsEmptyDesc: 'Mialiko, michango, na sasisho za malipo zitaonekana hapa.',
    quickAdd: 'Ongeza',
    quickPayDue: 'Lipa',
    quickCircles: 'Miduara',
    quickWithdraw: 'Toa',
    quickMoney: 'Pesa',
    quickPay: 'Lipa',
    duePrefix: 'Inadaiwa',
    recent: 'Hivi karibuni',
    activity: 'Shughuli',
    nothingYet: 'Bado hakuna',
    addPhone: 'Ongeza simu',
    addMoneyToPay: 'Ongeza pesa ili kulipa',
  },
  paySheet: {
    title: 'Lipa',
    subtitle: 'Ongeza, lipa deni, toa — au fungua zana yoyote ya pesa kutoka hapa.',
    addMoney: 'Ongeza pesa',
    addMoneyHint: 'Jaza salio lako la Amanah',
    withdraw: 'Toa',
    withdrawHint: 'Tuma kwenda M-Pesa au benki',
    payCircle: 'Miduara',
    payCircleHint: 'Fungua mduara kulipa michango',
    payDue: 'Lipa deni',
    payDueHint: 'Lipa mchango wako unaofuata',
    goals: 'Malengo',
    goalsHint: 'Hajj, Umra, na akiba binafsi',
    close: 'Funga',
    balanceLabel: 'Inayopatikana',
    openMoney: 'Pesa',
    openMoneyHint: 'Salio, historia, na ongezeko',
    sectionPay: 'Lipa na tuma',
    sectionSee: 'Angalia na panga',
    sectionGrow: 'Kopa na kukuza',
    sectionGive: 'Changia',
    moreTools: 'Zana zaidi',
    overdue: 'Imechelewa',
    insights: 'Ufahamu',
    insightsHint: 'Hadithi ya mwezi huu na madeni wazi',
    qard: 'Qard Hassan',
    qardHint: 'Mikopo ya mduara bila riba',
    welfare: 'Ustawi',
    welfareHint: 'Hazina za msaada wa mduara',
    invest: 'Uwekezaji',
    investHint: 'Hisa na chaguo za washirika',
    tawarruq: 'Tawarruq',
    tawarruqHint: 'Maombi ya fedha zinazofuata Sharia',
    sadaka: 'Sadaka',
    sadakaHint: 'Changia kampeni zilizoidhinishwa',
    zakat: 'Zakat',
    zakatHint: 'Kadiria unachodaiwa',
    allFinance: 'Zana zote za pesa',
    allFinanceHint: 'Kituo kamili cha Fedha',
  },
  contributionCard: {
    nextTitle: 'Mchango wako unaofuata',
    moneyAvailable: 'Pesa inayopatikana',
    due: 'Inadaiwa',
    overdue: 'imechelewa',
    payAheadAvailable: 'unaweza kulipa mapema',
    alreadyPaid: '{amount} tayari imelipwa',
    needWallet: 'Ongeza pesa kwenye pochi yako, kisha lipa mchango huu.',
    needMore: 'Unahitaji takriban {amount} zaidi ili kulipa kamili.',
    paysFromBalance:
      'Hulipwa kutoka salio lako la Amanah kwenda mduara. Acha kiasi tupu kwa salio lote lililobaki.',
    amountOptional: 'Kiasi (si lazima)',
    pay: 'Lipa',
    payAhead: 'Lipa mapema',
    addMoney: 'Ongeza pesa',
    addMoneyToPay: 'Ongeza pesa ili kulipa',
    partialAmount: 'Kiasi cha sehemu',
    payPartial: 'Lipa sehemu',
    calendar: 'Kalenda',
  },
  circles: {
    eyebrow: 'Miduara',
    title: 'Miduara yangu',
    subtitle: 'Miduara yote ya akiba inayozunguka iliyounganishwa na akaunti yako.',
    createCircle: 'Unda mduara',
    emptyTitle: 'Bado hujajiunga na mduara',
    emptyDesc: 'Unda mduara mpya, au weka msimbo wa mwaliko hapo juu ili ujiunge.',
    createACircle: 'Unda mduara',
    redeemTitle: 'Weka msimbo wa mwaliko',
    redeemHint:
      'Bandika msimbo mfupi au kiungo kamili cha mwaliko kutoka WhatsApp.',
    redeemPlaceholder: 'AB3K7M2Q au https://…/invitations/…',
    redeemSubmit: 'Jiunge kwa msimbo',
    redeemWorking: 'Inafungua…',
    redeemInvalid: 'Bandika msimbo wa herufi 6–8 au kiungo cha /invitations/….',
  },
  wallet: {
    eyebrow: 'Pesa',
    title: 'Pesa',
    subtitle: 'Salio, ongezeko, na utoaji.',
    emptyTitle: 'Bado hakuna akaunti ya Pesa',
    emptyDesc: 'Pochi yako inafunguka pamoja na wasifu wako.',
    totalBalance: 'Salio jumla {amount}',
    topUp: 'Ongeza pesa',
    withdraw: 'Toa',
    paymentsInProgress: 'Inaendelea',
    pendingPaystackHint:
      'Ulishalipa? Subiri kidogo au angalia hali.',
    failedPayments: 'Imeshindikana — jaribu tena',
    historyTitle: 'Historia',
    historyEmpty:
      'Ongezeko, michango, na malipo yataonekana hapa.',
    availableLabel: 'Inayopatikana',
    quickSave: 'Okoa',
    quickInsights: 'Ufahamu',
    moreTitle: 'Zaidi',
    moreDesc: 'Mikopo, malengo, na kuchangia.',
    moreGoals: 'Malengo',
    moreGoalsDesc: 'Hajj, Umra, na akiba binafsi',
    moreQard: 'Qard Hassan',
    moreQardDesc: 'Mikopo ya mduara bila riba',
    moreSadakaDesc: 'Changia kampeni zilizoidhinishwa',
    moreZakat: 'Zakat',
    moreZakatDesc: 'Kadiria unachodaiwa',
    phoneBannerTitle: 'Ongeza simu ya Kenya',
    phoneBannerBody: 'SMS na utoaji zinahitaji nambari ya +254 kwenye wasifu.',
    addPhone: 'Ongeza simu',
    payContributionCta: 'Lipa mchango',
    memberMoney: 'Mwanachama',
  },
  walletForms: {
    amount: 'Kiasi ({currency})',
    mpesaPhone: 'Simu ya M-Pesa',
    paystackHint:
      'Lipa salama kwa M-Pesa, kadi, au benki. Utathibitisha kwenye skrini inayofuata.',
    paystackReturnHint:
      'Baada ya malipo, unarudi hapa. Salio likichelewa, bofya Angalia hali.',
    bankHint: 'Ongezeko la benki linaunda ombi linalosubiri kuthibitishwa.',
    simulatedHint:
      'Salio la majaribio papo hapo (bila M-Pesa). Tumia kulipa michango wakati wa majaribio.',
    processing: 'Inashughulikia…',
    payMpesa: 'Lipa kwa M-Pesa',
    payPaystack: 'Endelea kulipa',
    startBank: 'Anza ongezeko la benki',
    topUpWallet: 'Ongeza pesa',
    bank: 'Benki',
    bankName: 'Jina la benki',
    accountName: 'Jina la akaunti',
    accountNumber: 'Nambari ya akaunti',
    submitting: 'Inawasilisha…',
    requestWithdrawal: 'Omba kutoa pesa',
    retry: 'Jaribu tena',
    retrying: 'Inajaribu tena…',
    checkStatus: 'Angalia hali',
    checkingStatus: 'Inaangalia…',
    stepUpHint: 'Tunatuma SMS ya nambari 6 kwenye simu ya wasifu kabla pesa haijahanishwa.',
    verificationCode: 'Msimbo wa SMS',
    sendCode: 'Tuma msimbo mpya',
    confirmWithCode: 'Thibitisha',
  },
  finance: {
    eyebrow: 'Fedha',
    title: 'Fedha',
    subtitle:
      'Zana za pochi ya kibinafsi na fedha za miduara zinazofuata sheria — malengo, ustawi, Qard, na zaidi.',
    moneyAvailable: 'Pesa inayopatikana',
    openDuesOne: 'Deni {count} wazi · {amount} imebaki',
    openDuesMany: 'Madeni {count} wazi · {amount} yamebaki',
    noOpenDues: 'Hakuna michango inayodaiwa',
    addMoney: 'Ongeza pesa',
    payDues: 'Lipa madeni',
    goalsCta: 'Malengo',
    insightsTitle: 'Ufahamu',
    insightsDesc: 'Mapato ya mwezi, kiwango cha kulipa kwa wakati, na madeni yanayokuja.',
    shariaCta: 'Shariah',
    welfareTitle: 'Hazina ya ustawi',
    welfareDesc: 'Msaada wa matibabu, mazishi, na ajali kwa mduara wako.',
    qardTitle: 'Qard Hassan',
    qardDesc: 'Omba na lipa mikopo ya mduara bila riba.',
    tawarruqTitle: 'Tawarruq',
    tawarruqDesc: 'Omba fedha zinazofuata Sharia kupitia washirika.',
    goalsTitle: 'Malengo ya akiba',
    goalsDesc: 'Okoa kwa Hajj, Umra, Udhiyah, au lengo lolote la kibinafsi.',
    investTitle: 'Uwekezaji',
    investDesc: 'Hisa za mduara, miradi ya hazina, na chaguo za fedha za washirika.',
    investSharesTitle: 'Hisa za mduara',
    investSharesBody:
      'Nunua na shikilia hisa za uanachama katika mduara wako. Thamani ya hisa na gawio husimamiwa na maafisa kwa rekodi wazi.',
    investSharesCta: 'Fungua hisa',
    investSharesJoinCta: 'Jiunge na mduara kwanza',
    investTreasuryTitle: 'Miradi ya hazina',
    investTreasuryBody:
      'Miduara inaweza kurekodi uwekezaji na miradi inayofuata Shariah katika hazina — ili wanachama waone pesa za pamoja zinakokwenda.',
    investTreasuryCta: 'Fungua hazina',
    investTreasuryBrowseCta: 'Vinjari miduara',
    investTawarruqTitle: 'Tawarruq ya washirika',
    investTawarruqBody:
      'Unapohitaji fedha kubwa nje ya hazina ya mduara, omba Tawarruq kupitia washirika — tofauti na Qard isiyo na riba.',
    investTawarruqCta: 'Gundua Tawarruq',
    investYourCircles: 'Miduara yako',
    investEmptyTitle: 'Bado hakuna miduara',
    investEmptyDesc:
      'Jiunge au unda mduara ili ufikie hisa na rekodi za uwekezaji wa hazina.',
    investEmptyCta: 'Nenda Miduara',
    backToFinance: 'Rudi Fedha',
    shariaTitle: 'Shariah kwenye Amanah',
    shariaLead:
      'Miduara huepuka riba kati ya wanachama. Qard haina riba. Ustawi na kutoa huunga mkono utunzaji wa pamoja. Tawarruq ya washirika ni njia tofauti ya fedha za Sharia — si fatwa.',
    welfareOverview: 'Muhtasari wa ustawi',
    circleFallback: 'Mduara',
    noWelfare: 'Miduara yako bado haina hazina za ustawi.',
  },
  profile: {
    eyebrow: 'Wewe',
    title: 'Wewe',
    subtitle: 'Jina, simu, na uthibitisho.',
    youFallback: 'Wewe',
    amanahScore: 'Alama ya Amanah',
    scoreExcellent: 'Bora',
    scoreStrong: 'Imara',
    scoreBuilding: 'Inajengwa',
    appearance: 'Muonekano',
    linkMoney: 'Pesa',
    linkGoals: 'Malengo',
    linkVerification: 'Uthibitisho',
    linkZakat: 'Zakat',
    linkSupport: 'Msaada',
    onboardingEyebrow: 'Karibu tayari',
    onboardingTitle: 'Karibu Amanah',
    onboardingBody:
      'Ongeza jina na simu ya Kenya kwa uhamishaji salama wa pesa. Uthibitisho unapendekezwa kabla ya uhamishaji mkubwa.',
    onboardingStepName: 'Hifadhi jina lako kamili',
    onboardingStepPhone: 'Ongeza simu ya Kenya (+254…)',
    onboardingStepKyc: 'Pakia hati ya uthibitisho (si lazima)',
    onboardingHome: 'Nyumbani',
    onboardingAddName: 'Ongeza jina lako',
    onboardingAddPhone: 'Ongeza simu yako',
    onboardingVerification: 'Uthibitisho',
    personalDetails: 'Taarifa binafsi',
    email: 'Barua pepe: {email}',
    mpesaLinkage: 'M-Pesa',
    kycDocuments: 'Uthibitisho',
    uploadedFiles: 'Faili zilizopakiwa',
    noDocuments: 'Bado hakuna hati zilizopakiwa.',
    fullName: 'Jina kamili',
    phone: 'Simu',
    countryCode: 'Msimbo wa nchi',
    bio: 'Wasifu mfupi',
    saving: 'Inahifadhi…',
    saveProfile: 'Hifadhi wasifu',
    mpesaNumber: 'Nambari ya M-Pesa',
    mpesaHint: 'Hutumika kwa STK za ongezeko na foleni za kutoa malipo.',
    linking: 'Inaunganisha…',
    linkMpesa: 'Unganisha M-Pesa',
    documentType: 'Aina ya hati',
    fileHint: 'Picha au PDF (picha za simu zinabanwa kiotomatiki · max ~10MB)',
    uploading: 'Inapakia…',
    uploadDocument: 'Pakia hati',
    nationalId: 'Kitambulisho cha taifa',
    passport: 'Pasipoti',
    drivingLicense: 'Leseni ya udereva',
    proofOfAddress: 'Uthibitisho wa anwani',
    selfie: 'Picha ya uso',
    other: 'Nyingine',
    referrals: 'Rufaa',
    yourReferralCode: 'Msimbo wako wa rufaa',
    copyCode: 'Nakili msimbo',
    applySomeoneCode: 'Tumia msimbo wa mtu mwingine',
    applying: 'Inatumia…',
    apply: 'Tumia',
    referralHint:
      'Rufaa inastahiki baada ya mchango wako wa kwanza uliolipwa. Zawadi huwekwa alama na msimamizi.',
  },
  notificationsPage: {
    eyebrow: 'Shughuli',
    title: 'Shughuli',
    unreadOne: 'Sasisho {count} halijasomwa',
    unreadMany: 'Sasisho {count} hayajasomwa',
    upToDate: 'Uko sawa.',
    markAllRead: 'Weka zote kama zimesomwa',
    markRead: 'Weka imesomwa',
    emptyTitle: 'Bado hakuna shughuli',
    emptyDesc: 'Mialiko ya miduara, vikumbusho vya michango, na sasisho za malipo vitaonekana hapa.',
    recentMoney: 'Pesa za hivi karibuni',
    openMoney: 'Pesa',
    openCircles: 'Miduara',
    openItem: 'Fungua',
  },
  support: {
    eyebrow: 'Saidia Amanah kukua',
    title: 'Saidia jukwaa la Amanah',
    body: 'Hii ni tipu ya hiari kuendeleza teknolojia, msaada, na shughuli za jamii za Amanah. Si sadaka na haifadhili kampeni ya hisani.',
    tipLabel: 'Tipu ya jukwaa (KES)',
    phoneOptional: 'Simu (si lazima)',
    submit: 'Saidia Amanah',
  },
  circle: {
    meetingsChat: 'Mikutano na gumzo',
    elections: 'Uchaguzi',
    circleKyc: 'KYC ya mduara',
    treasury: 'Hazina',
    shares: 'Hisa',
    journal: 'Jarida',
    invoices: 'Ankara',
    myStatement: 'Taarifa yangu',
    idReport: 'Taarifa ya mwanachama',
    officerConsole: 'Dashibodi ya ofisa',
    contribution: 'Mchango',
    members: 'Wanachama',
    cycle: 'Mzunguko',
    frequency: 'Marudio',
    everyDays: 'Kila baada ya siku {days}',
    startDate: 'Tarehe ya kuanza',
    notSet: 'Haijawekwa',
    creditSnapshot: 'Muhtasari wa mkopo wako',
    womensCircle: 'Mduara wa wanawake',
    bodaStage: 'Stage ya boda / tuktuk',
    womensBlurb: 'Ulinzi wa jamii na msaada wa ustawi kwa miduara ya akiba ya wanawake.',
    bodaBlurb: 'Akiba ya stage yenye msisitizo wa ustawi kwa waendesha na waendeshaji.',
    arrears: 'Malimbikizo',
    auditTrail: 'Rekodi ya ukaguzi',
    downloadPdf: 'Pakua PDF',
  },
  officer: {
    title: 'Dashibodi ya ofisa',
    auditEyebrow: 'Rekodi ya ukaguzi',
    auditIntro: 'Historia ya idhini mbili na mabadiliko ya hazina kwa mduara huu.',
    dualApprovalTrail: 'Maombi ya idhini mbili',
    noDualRequests: 'Bado hakuna maombi ya idhini mbili.',
    treasuryChanges: 'Mabadiliko ya hazina na vitabu',
    noTreasuryAudit: 'Bado hakuna rekodi za hazina.',
    allCircleAudit: 'Matukio yote ya ukaguzi wa mduara',
    arrearsEyebrow: 'Umri wa malimbikizo',
    arrearsIntro: 'Michango isiyolipwa kwa vipindi vya umri, pamoja na ratiba ya faini.',
    bucketCurrent: 'Ya sasa (haijachelewa)',
    bucket17: 'Siku 1–7',
    bucket830: 'Siku 8–30',
    bucket3160: 'Siku 31–60',
    bucket61: 'Siku 61+',
    bucketTotal: 'Jumla inayosubiri',
    autoFineTitle: 'Ratiba ya faini otomatiki',
    autoFineIntro:
      'Baada ya siku za neema, michango iliyochelewa huwekwa late na faini hutathminiwa.',
    autoFineEnable: 'Washa faini otomatiki za kuchelewa',
    graceDays: 'Siku za neema baada ya tarehe ya kulipa',
    saveAutoFine: 'Hifadhi mipangilio ya faini',
    runAutoFinesNow: 'Endesha faini sasa',
    memberArrears: 'Wanachama wenye malimbikizo',
    noArrears: 'Hakuna malimbikizo yaliyo wazi.',
    openItems: 'vipengele wazi',
    overdue: 'zimechelewa',
    qardQueue: 'Foleni ya Qard na kafala',
    noPendingQard: 'Hakuna mikopo inayosubiri uamuzi wa ofisa.',
    kafalaPending: 'Dhamana zinazosubiri',
    approveLoan: 'Idhinisha mkopo',
    rejectLoan: 'Kataa',
  },
  admin: {
    sadakaTitle: 'Sadaka na ada za Sharia',
    shariaBoardPanel: 'Idhini ya bodi ya Sharia',
    shariaBoardHint:
      'Kuidhinisha kampeni kunahitaji rejeleo la uamuzi wa bodi. Kampeni zisizoidhinishwa zinabaki kusubiri.',
    decisionRefRequired: 'Rejeleo la uamuzi linahitajika ili kuidhinisha.',
    auditTitle: 'Ukaguzi wa jukwaa',
  },
  install: {
    title: 'Ongeza Amanah kwenye kifaa chako',
    detailNative: 'Sakinisha Amanah kwa ufikiaji wa haraka kwenye simu au kompyuta.',
    detailIos:
      'Shiriki → Ongeza kwenye Skrini ya Nyumbani kwa kufungua miduara na pochi kwa mguso mmoja.',
    detailAndroid:
      'Chrome inaweza kuficha Sakinisha hadi utembelee mara kadhaa. Tumia menyu (⋮) → Sakinisha programu au Ongeza kwenye skrini ya nyumbani. Fungua katika Chrome (si kivinjari cha ndani ya programu).',
    install: 'Sakinisha',
    opening: 'Inafungua…',
    notNow: 'Si sasa',
  },
  errors: {
    title: 'Kuna hitilafu',
    body: 'Tunajaribu tena ukurasa huu. Gusa hapa chini usipopakia kiotomatiki.',
    tryAgain: 'Jaribu tena',
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
