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
    orPayPhone: string;
    paysFromBalance: string;
    amountOptional: string;
    pay: string;
    payAhead: string;
    addMoney: string;
    addMoneyToPay: string;
    partialAmount: string;
    payPartial: string;
    mpesaPhone: string;
    payPhone: string;
    payPhoneInstead: string;
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
    pendingStkHint: string;
    failedPayments: string;
    failedPaymentsHint: string;
    withdrawalsInProgress: string;
    pendingWithdrawalsHint: string;
    historyTitle: string;
    historyEmpty: string;
    availableLabel: string;
    quickPay: string;
    quickSave: string;
    quickInsights: string;
    quickMore: string;
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
    stkPromptHint: string;
    intasendPartnerHint: string;
    withdrawMpesaHint: string;
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
    investMultiHint: string;
    investActiveProjects: string;
    investActiveProjectsDesc: string;
    investStatementCta: string;
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
    scoreHint: string;
    scoreNotCredit: string;
    scoreStepPhone: string;
    scoreStepProfile: string;
    scoreStepDocs: string;
    scoreStepKyc: string;
    scoreNext: string;
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
    tagline: 'Community Finance · Digital · For All',
    description:
      'Community finance, digital, for all — trusted circles, wallet, and savings.',
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
    startWithPhone: 'Get started',
    joinCircle: 'How Jameiyah works',
    preferEmail: 'Prefer email or Google?',
    createAccount: 'Create account',
    shariaEyebrow: 'Shariah',
    shariaTitle: 'How Jameiyah stays Shariah-conscious',
    shariaLead:
      'Jameiyah is built for communities that want money tools without riba at the centre — with clear records and mutual support.',
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
    intro: 'Interest-free loans from your circle pool.',
    capPrefix: 'Your request cap:',
    purpose: 'Purpose',
    amount: 'Amount ({currency})',
    installments: 'Installments',
    guarantorsLabel: 'Ask members to guarantee (optional)',
    guarantorsHint: 'Hold Ctrl/Cmd to select more than one.',
    requestLoan: 'Request loan',
    guaranteeInbox: 'Guarantee requests for you',
    guaranteeAcceptNote: 'Accepting means you stand as kafala if they default.',
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
    acceptAgreementHint: 'Interest-free Qard Hassan — accept to continue.',
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
    completeProfileHint: ' Add your name and phone to finish setup.',
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
    contributionsDesc: 'Open or late dues.',
    contributionsEmptyTitle: 'Nothing due right now',
    contributionsEmptyDesc: 'New dues will show here.',
    cycleDue: 'Cycle {cycle} · Due {date}',
    paid: 'Paid',
    amountPlaceholder: 'Amount (blank = full)',
    myCirclesTitle: 'My circles',
    myCirclesDesc: 'Circles you belong to.',
    noCirclesTitle: 'No circles yet',
    noCirclesDesc: 'Create a circle or accept an invite.',
    createACircle: 'Create a circle',
    position: 'Position #{n}',
    payoutsTitle: 'Payout schedule',
    payoutsDesc: 'Your upcoming turns.',
    payoutsEmptyTitle: 'No payouts scheduled',
    payoutsEmptyDesc: 'Turns appear once order is set.',
    cycleScheduled: 'Cycle {cycle} · Scheduled {date}',
    notificationsTitle: 'Notifications',
    unread: '{count} unread',
    notificationsDesc: 'Recent circle updates.',
    notificationsEmptyTitle: "You're all caught up",
    notificationsEmptyDesc: 'Invites and dues land here.',
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
    subtitle: 'Add money, settle dues, or withdraw.',
    addMoney: 'Add money',
    addMoneyHint: 'Top up',
    withdraw: 'Withdraw',
    withdrawHint: 'M-Pesa or bank',
    payCircle: 'Circles',
    payCircleHint: 'Pay dues',
    payDue: 'Pay due',
    payDueHint: 'Next contribution',
    goals: 'Goals',
    goalsHint: 'Personal saves',
    close: 'Close',
    balanceLabel: 'Available',
    openMoney: 'Money',
    openMoneyHint: 'Balance and history',
    sectionPay: 'Pay & send',
    sectionSee: 'See & plan',
    sectionGrow: 'Borrow & grow',
    sectionGive: 'Give',
    moreTools: 'More',
    overdue: 'Overdue',
    insights: 'Insights',
    insightsHint: 'This month',
    qard: 'Qard Hassan',
    qardHint: 'Interest-free loans',
    welfare: 'Welfare',
    welfareHint: 'Support funds',
    invest: 'Invest',
    investHint: 'Shares',
    tawarruq: 'Tawarruq',
    tawarruqHint: 'Shariah finance',
    sadaka: 'Sadaka',
    sadakaHint: 'Give',
    zakat: 'Zakat',
    zakatHint: 'Estimate',
    allFinance: 'All money tools',
    allFinanceHint: 'Finance hub',
  },
  contributionCard: {
    nextTitle: 'Your next contribution',
    moneyAvailable: 'Money available',
    due: 'Due',
    overdue: 'overdue',
    payAheadAvailable: 'pay ahead available',
    alreadyPaid: '{amount} already paid',
    needWallet: 'Add money, then pay.',
    needMore: 'Need about {amount} more.',
    orPayPhone: 'Or pay from your phone.',
    paysFromBalance: 'Pays from balance. Blank = full amount.',
    amountOptional: 'Amount (optional)',
    pay: 'Pay',
    payAhead: 'Pay ahead',
    addMoney: 'Add money',
    addMoneyToPay: 'Add money to pay',
    partialAmount: 'Partial amount',
    payPartial: 'Pay partial',
    mpesaPhone: 'M-Pesa phone',
    payPhone: 'Pay with M-Pesa',
    payPhoneInstead: 'Pay with M-Pesa instead',
    calendar: 'Calendar',
  },
  circles: {
    eyebrow: 'Circles',
    title: 'Circles',
    subtitle: 'Your savings circles.',
    createCircle: 'Create circle',
    emptyTitle: 'No circles yet',
    emptyDesc: 'Create a circle, or join with an invite code.',
    createACircle: 'Create a circle',
    redeemTitle: 'Enter invite code',
    redeemHint: 'Paste a short code or join link.',
    redeemPlaceholder: 'AB3K7M2Q or https://…/invitations/…',
    redeemSubmit: 'Join with code',
    redeemWorking: 'Opening…',
    redeemInvalid: 'Paste a 6–8 character invite code or an /invitations/… link.',
  },
  wallet: {
    eyebrow: 'Money',
    title: 'Money',
    subtitle: 'Add money, pay, or withdraw.',
    emptyTitle: 'No balance yet',
    emptyDesc: 'Your wallet opens automatically with your profile.',
    totalBalance: 'Total balance {amount}',
    topUp: 'Add money',
    withdraw: 'Withdraw',
    paymentsInProgress: 'In progress',
    pendingPaystackHint: 'Already paid? Wait a moment or check status.',
    pendingStkHint: 'Approve the M-Pesa prompt, then Check status if needed.',
    failedPayments: 'Failed',
    failedPaymentsHint: 'Retry sends a fresh prompt.',
    withdrawalsInProgress: 'Withdrawals',
    pendingWithdrawalsHint: 'Waiting on approval or send.',
    historyTitle: 'History',
    historyEmpty: 'No transactions yet.',
    availableLabel: 'Available',
    quickPay: 'Pay',
    quickSave: 'Save',
    quickInsights: 'Insights',
    quickMore: 'More',
    moreTitle: 'More',
    moreDesc: 'Goals, loans, giving.',
    moreGoals: 'Goals',
    moreGoalsDesc: 'Personal saves',
    moreQard: 'Qard Hassan',
    moreQardDesc: 'Interest-free loans',
    moreSadakaDesc: 'Give',
    moreZakat: 'Zakat',
    moreZakatDesc: 'Estimate',
    phoneBannerTitle: 'Add your phone',
    phoneBannerBody: 'Needed for M-Pesa top-ups.',
    addPhone: 'Add phone',
    payContributionCta: 'Continue to contribution',
    memberMoney: 'Member',
  },
  walletForms: {
    amount: 'Amount ({currency})',
    mpesaPhone: 'M-Pesa phone',
    paystackHint: 'Pay with M-Pesa, card, or bank on the next screen.',
    paystackReturnHint: 'After payment, return here. Tap Check status if needed.',
    bankHint: 'Bank top-up creates a pending settlement request.',
    simulatedHint: 'Instant demo credit (no M-Pesa).',
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
    stepUpHint: 'For M-Pesa, approve the phone prompt. Other methods may SMS a code.',
    stkPromptHint: 'Approve the prompt on this number.',
    intasendPartnerHint: 'Partner names (e.g. Co-op) still credit Jameiyah.',
    withdrawMpesaHint: 'Pays to your linked M-Pesa after approval.',
    verificationCode: 'SMS code',
    sendCode: 'Send new code',
    confirmWithCode: 'Confirm',
  },
  finance: {
    eyebrow: 'Finance',
    title: 'Finance',
    subtitle: 'Goals, loans, and giving.',
    moneyAvailable: 'Money available',
    openDuesOne: '{count} open due · {amount} left',
    openDuesMany: '{count} open dues · {amount} left',
    noOpenDues: 'No open contribution dues',
    addMoney: 'Add money',
    payDues: 'Pay dues',
    goalsCta: 'Goals',
    insightsTitle: 'Insights',
    insightsDesc: 'Inflow, on-time rate, upcoming dues.',
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
    investDesc: 'Circle shares and projects — not a personal portfolio.',
    investSharesTitle: 'Circle shares',
    investSharesBody: 'Membership shares and dividends.',
    investSharesCta: 'Shares',
    investSharesJoinCta: 'Join a circle first',
    investTreasuryTitle: 'Circle projects',
    investTreasuryBody: 'Land, stock, or equipment on the books.',
    investTreasuryCta: 'Projects',
    investTreasuryBrowseCta: 'Circles',
    investTawarruqTitle: 'Partner Tawarruq',
    investTawarruqBody: 'Larger finance outside the circle pool.',
    investTawarruqCta: 'Tawarruq',
    investYourCircles: 'Your circles',
    investMultiHint: 'Open each circle for its own shares.',
    investActiveProjects: 'Active circle projects',
    investActiveProjectsDesc: 'Across your circles.',
    investStatementCta: 'Statement',
    investEmptyTitle: 'No circles yet',
    investEmptyDesc: 'Join or create a circle for shares and treasury.',
    investEmptyCta: 'Circles',
    backToFinance: 'Finance',
    shariaTitle: 'Shariah on Jameiyah',
    shariaLead:
      'Circles avoid riba between members. Qard is interest-free. Welfare and giving support mutual care. Partner Tawarruq is offered as a separate Sharia finance path — not a fatwa.',
    welfareOverview: 'Welfare overview',
    circleFallback: 'Circle',
    noWelfare: 'No welfare funds yet.',
  },
  profile: {
    eyebrow: 'You',
    title: 'You',
    subtitle: 'Name, phone, and verification.',
    youFallback: 'You',
    amanahScore: 'Jameiyah Score',
    scoreExcellent: 'Strong setup',
    scoreStrong: 'Getting there',
    scoreBuilding: 'Just starting',
    scoreHint: 'How complete your Jameiyah profile is',
    scoreNotCredit: 'Not a bank or CRB credit score',
    scoreStepPhone: 'Kenya mobile',
    scoreStepProfile: 'Name on profile',
    scoreStepDocs: 'ID document uploaded',
    scoreStepKyc: 'KYC approved',
    scoreNext: 'See savings insights',
    appearance: 'Appearance',
    linkMoney: 'Money',
    linkGoals: 'Goals',
    linkVerification: 'Verification',
    linkZakat: 'Zakat',
    linkSupport: 'Support',
    onboardingEyebrow: 'Almost ready',
    onboardingTitle: 'Welcome to Jameiyah',
    onboardingBody: 'Add your name and Kenya mobile to get started.',
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
    mpesaHint: 'Used for top-ups and withdrawals.',
    linking: 'Linking…',
    linkMpesa: 'Link M-Pesa',
    documentType: 'Document type',
    fileHint: 'Photo or PDF · max ~10MB',
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
    referralHint: 'Qualifies after your first paid contribution.',
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
    emptyDesc: 'Invites, dues, and payouts appear here.',
    recentMoney: 'Recent money',
    openMoney: 'Money',
    openCircles: 'Circles',
    openItem: 'Open',
  },
  support: {
    eyebrow: 'Support Jameiyah',
    title: 'Support Jameiyah',
    body: 'A voluntary tip for the platform — not sadaka.',
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
    womensBlurb: 'Gatekeeping and welfare for women’s circles.',
    bodaBlurb: 'Stage savings with welfare for riders.',
    arrears: 'Arrears',
    auditTrail: 'Audit trail',
    downloadPdf: 'Download PDF',
  },
  officer: {
    title: 'Officer console',
    auditEyebrow: 'Audit trail',
    auditIntro: 'Dual-approval and treasury changes.',
    dualApprovalTrail: 'Dual-approval requests',
    noDualRequests: 'No dual-approval requests yet.',
    treasuryChanges: 'Treasury & books',
    noTreasuryAudit: 'No treasury audit yet.',
    allCircleAudit: 'All circle audit events',
    arrearsEyebrow: 'Arrears',
    arrearsIntro: 'Outstanding dues by age.',
    bucketCurrent: 'Current',
    bucket17: '1–7 days',
    bucket830: '8–30 days',
    bucket3160: '31–60 days',
    bucket61: '61+ days',
    bucketTotal: 'Total outstanding',
    autoFineTitle: 'Auto-fine',
    autoFineIntro: 'After grace, late contributions get penalties.',
    autoFineEnable: 'Enable automatic late fines',
    graceDays: 'Grace days after due',
    saveAutoFine: 'Save',
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
    title: 'Add Jameiyah to your device',
    detailNative: 'Install Jameiyah for quick access on your phone or desktop.',
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
    tagline: 'Fedha za Jamii · Kidijitali · Kwa Wote',
    description:
      'Fedha za jamii, kidijitali, kwa wote — miduara yenye uaminifu, pochi, na akiba.',
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
    joinCircle: 'Gundua Jameiyah',
    preferEmail: 'Unapendelea barua pepe au Google?',
    createAccount: 'Fungua akaunti',
    shariaEyebrow: 'Shariah',
    shariaTitle: 'Jinsi Jameiyah inavyofuata Shariah',
    shariaLead:
      'Jameiyah imeundwa kwa jamii zinazotaka zana za fedha bila riba kuwa kiini — na rekodi wazi na msaada wa pamoja.',
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
    intro: 'Mikopo bila riba kutoka hazina ya mduara.',
    capPrefix: 'Kikomo chako cha ombi:',
    purpose: 'Madhumuni',
    amount: 'Kiasi ({currency})',
    installments: 'Malipo ya awamu',
    guarantorsLabel: 'Waombe wanachama kukuhakikishia (si lazima)',
    guarantorsHint: 'Shikilia Ctrl/Cmd kuchagua zaidi ya mmoja.',
    requestLoan: 'Omba mkopo',
    guaranteeInbox: 'Maombi ya kafala kwako',
    guaranteeAcceptNote: 'Kukubali kunamaanisha unasimama kafala ikiwa wameshindwa kulipa.',
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
    acceptAgreementHint: 'Qard Hassan bila riba — kubali ili kuendelea.',
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
    subtitle: 'Miduara, michango, na malipo.',
    completeProfileHint: ' Ongeza jina na simu kumaliza usanidi.',
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
    contributionsDesc: 'Michango wazi au iliyochelewa.',
    contributionsEmptyTitle: 'Hakuna kinachodaiwa sasa',
    contributionsEmptyDesc: 'Michango mipya itaonekana hapa.',
    cycleDue: 'Mzunguko {cycle} · Inadaiwa {date}',
    paid: 'Imelipwa',
    amountPlaceholder: 'Kiasi (tupu = kamili)',
    myCirclesTitle: 'Miduara yangu',
    myCirclesDesc: 'Miduara uliyojiunga.',
    noCirclesTitle: 'Bado hakuna miduara',
    noCirclesDesc: 'Unda mduara au kubali mwaliko.',
    createACircle: 'Unda mduara',
    position: 'Nafasi #{n}',
    payoutsTitle: 'Ratiba ya malipo',
    payoutsDesc: 'Zamu zako zinazokuja.',
    payoutsEmptyTitle: 'Hakuna malipo yaliyoratibiwa',
    payoutsEmptyDesc: 'Zamu zinaonekana baada ya mpangilio.',
    cycleScheduled: 'Mzunguko {cycle} · Imepangwa {date}',
    notificationsTitle: 'Arifa',
    unread: '{count} hazijasomwa',
    notificationsDesc: 'Sasisho za miduara.',
    notificationsEmptyTitle: 'Umesoma zote',
    notificationsEmptyDesc: 'Mialiko na michango huonekana hapa.',
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
    subtitle: 'Ongeza, lipa, au toa.',
    addMoney: 'Ongeza pesa',
    addMoneyHint: 'Jaza salio',
    withdraw: 'Toa',
    withdrawHint: 'M-Pesa au benki',
    payCircle: 'Miduara',
    payCircleHint: 'Lipa michango',
    payDue: 'Lipa deni',
    payDueHint: 'Mchango unaofuata',
    goals: 'Malengo',
    goalsHint: 'Akiba binafsi',
    close: 'Funga',
    balanceLabel: 'Inayopatikana',
    openMoney: 'Pesa',
    openMoneyHint: 'Salio na historia',
    sectionPay: 'Lipa na tuma',
    sectionSee: 'Angalia na panga',
    sectionGrow: 'Kopa na kukuza',
    sectionGive: 'Changia',
    moreTools: 'Zaidi',
    overdue: 'Imechelewa',
    insights: 'Ufahamu',
    insightsHint: 'Mwezi huu',
    qard: 'Qard Hassan',
    qardHint: 'Mikopo bila riba',
    welfare: 'Ustawi',
    welfareHint: 'Hazina za msaada',
    invest: 'Uwekezaji',
    investHint: 'Hisa',
    tawarruq: 'Tawarruq',
    tawarruqHint: 'Fedha za Sharia',
    sadaka: 'Sadaka',
    sadakaHint: 'Changia',
    zakat: 'Zakat',
    zakatHint: 'Kadiria',
    allFinance: 'Zana zote za pesa',
    allFinanceHint: 'Kituo cha Fedha',
  },
  contributionCard: {
    nextTitle: 'Mchango wako unaofuata',
    moneyAvailable: 'Pesa inayopatikana',
    due: 'Inadaiwa',
    overdue: 'imechelewa',
    payAheadAvailable: 'unaweza kulipa mapema',
    alreadyPaid: '{amount} tayari imelipwa',
    needWallet: 'Ongeza pesa, kisha lipa.',
    needMore: 'Unahitaji takriban {amount} zaidi.',
    orPayPhone: 'Au lipa kutoka simu.',
    paysFromBalance: 'Hulipwa kutoka salio. Tupu = salio lote.',
    amountOptional: 'Kiasi (si lazima)',
    pay: 'Lipa',
    payAhead: 'Lipa mapema',
    addMoney: 'Ongeza pesa',
    addMoneyToPay: 'Ongeza pesa ili kulipa',
    partialAmount: 'Kiasi cha sehemu',
    payPartial: 'Lipa sehemu',
    mpesaPhone: 'Nambari ya M-Pesa',
    payPhone: 'Lipa kwa M-Pesa',
    payPhoneInstead: 'Lipa kwa M-Pesa badala yake',
    calendar: 'Kalenda',
  },
  circles: {
    eyebrow: 'Miduara',
    title: 'Miduara yangu',
    subtitle: 'Miduara yako ya akiba.',
    createCircle: 'Unda mduara',
    emptyTitle: 'Bado hujajiunga na mduara',
    emptyDesc: 'Unda mduara, au weka msimbo wa mwaliko.',
    createACircle: 'Unda mduara',
    redeemTitle: 'Weka msimbo wa mwaliko',
    redeemHint: 'Bandika msimbo mfupi au kiungo.',
    redeemPlaceholder: 'AB3K7M2Q au https://…/invitations/…',
    redeemSubmit: 'Jiunge kwa msimbo',
    redeemWorking: 'Inafungua…',
    redeemInvalid: 'Bandika msimbo wa herufi 6–8 au kiungo cha /invitations/….',
  },
  wallet: {
    eyebrow: 'Pesa',
    title: 'Pesa',
    subtitle: 'Ongeza, lipa, au toa.',
    emptyTitle: 'Bado hakuna akaunti ya Pesa',
    emptyDesc: 'Pochi yako inafunguka pamoja na wasifu wako.',
    totalBalance: 'Salio jumla {amount}',
    topUp: 'Ongeza pesa',
    withdraw: 'Toa',
    paymentsInProgress: 'Inaendelea',
    pendingPaystackHint: 'Ulishalipa? Subiri kidogo au angalia hali.',
    pendingStkHint: 'Idhinisha ombi la M-Pesa, kisha Angalia hali ikiwa inahitajika.',
    failedPayments: 'Imeshindikana',
    failedPaymentsHint: 'Jaribu tena hutuma ombi jipya.',
    withdrawalsInProgress: 'Utoaji',
    pendingWithdrawalsHint: 'Inangoja idhini au utumaji.',
    historyTitle: 'Historia',
    historyEmpty: 'Bado hakuna shughuli.',
    availableLabel: 'Inayopatikana',
    quickPay: 'Lipa',
    quickSave: 'Okoa',
    quickInsights: 'Ufahamu',
    quickMore: 'Zaidi',
    moreTitle: 'Zaidi',
    moreDesc: 'Malengo, mikopo, kuchangia.',
    moreGoals: 'Malengo',
    moreGoalsDesc: 'Akiba binafsi',
    moreQard: 'Qard Hassan',
    moreQardDesc: 'Mikopo bila riba',
    moreSadakaDesc: 'Changia',
    moreZakat: 'Zakat',
    moreZakatDesc: 'Kadiria',
    phoneBannerTitle: 'Ongeza simu',
    phoneBannerBody: 'Inahitajika kwa M-Pesa.',
    addPhone: 'Ongeza simu',
    payContributionCta: 'Endelea na mchango',
    memberMoney: 'Mwanachama',
  },
  walletForms: {
    amount: 'Kiasi ({currency})',
    mpesaPhone: 'Simu ya M-Pesa',
    paystackHint: 'Lipa kwa M-Pesa, kadi, au benki kwenye skrini inayofuata.',
    paystackReturnHint: 'Baada ya malipo, rudi hapa. Bofya Angalia hali ikiwa inahitajika.',
    bankHint: 'Ongezeko la benki linaunda ombi linalosubiri.',
    simulatedHint: 'Salio la majaribio papo hapo (bila M-Pesa).',
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
    stepUpHint: 'Kwa M-Pesa, idhinisha ombi kwenye simu. Njia zingine zinaweza kutuma SMS.',
    stkPromptHint: 'Idhinisha ombi kwenye nambari hii.',
    intasendPartnerHint: 'Majina ya washirika (k.m. Co-op) bado yanalipa Jameiyah.',
    withdrawMpesaHint: 'Hulipwa M-Pesa yako baada ya idhini.',
    verificationCode: 'Msimbo wa SMS',
    sendCode: 'Tuma msimbo mpya',
    confirmWithCode: 'Thibitisha',
  },
  finance: {
    eyebrow: 'Fedha',
    title: 'Fedha',
    subtitle: 'Malengo, mikopo, na kuchangia.',
    moneyAvailable: 'Pesa inayopatikana',
    openDuesOne: 'Deni {count} wazi · {amount} imebaki',
    openDuesMany: 'Madeni {count} wazi · {amount} yamebaki',
    noOpenDues: 'Hakuna michango inayodaiwa',
    addMoney: 'Ongeza pesa',
    payDues: 'Lipa madeni',
    goalsCta: 'Malengo',
    insightsTitle: 'Ufahamu',
    insightsDesc: 'Mapato, kulipa kwa wakati, madeni yanayokuja.',
    shariaCta: 'Shariah',
    welfareTitle: 'Hazina ya ustawi',
    welfareDesc: 'Matibabu, mazishi, na ajali.',
    qardTitle: 'Qard Hassan',
    qardDesc: 'Mikopo bila riba kutoka mduara.',
    tawarruqTitle: 'Tawarruq',
    tawarruqDesc: 'Fedha za Sharia kupitia washirika.',
    goalsTitle: 'Malengo ya akiba',
    goalsDesc: 'Hajj, Umra, Udhiyah, au lengo lolote.',
    investTitle: 'Uwekezaji',
    investDesc: 'Hisa na miradi ya mduara — si portfolio binafsi.',
    investSharesTitle: 'Hisa za mduara',
    investSharesBody: 'Nunua na shikilia hisa. Maafisa huhifadhi thamani na gawio.',
    investSharesCta: 'Hisa',
    investSharesJoinCta: 'Jiunge na mduara kwanza',
    investTreasuryTitle: 'Miradi ya mduara',
    investTreasuryBody: 'Maafisa hurekodi ardhi, hisa, au vifaa katika hazina.',
    investTreasuryCta: 'Miradi',
    investTreasuryBrowseCta: 'Miduara',
    investTawarruqTitle: 'Tawarruq ya washirika',
    investTawarruqBody: 'Fedha kubwa nje ya hazina ya mduara, tofauti na Qard.',
    investTawarruqCta: 'Tawarruq',
    investYourCircles: 'Miduara yako',
    investMultiHint: 'Uko katika miduara zaidi ya moja? Fungua kila moja kwa hisa na taarifa yake.',
    investActiveProjects: 'Miradi hai ya miduara',
    investActiveProjectsDesc: 'Miradi katika miduara uliyojiunga.',
    investStatementCta: 'Taarifa',
    investEmptyTitle: 'Bado hakuna miduara',
    investEmptyDesc: 'Jiunge au unda mduara kwa hisa na hazina.',
    investEmptyCta: 'Miduara',
    backToFinance: 'Fedha',
    shariaTitle: 'Shariah kwenye Jameiyah',
    shariaLead:
      'Miduara huepuka riba kati ya wanachama. Qard haina riba. Ustawi na kutoa huunga mkono utunzaji wa pamoja. Tawarruq ya washirika ni njia tofauti ya fedha za Sharia — si fatwa.',
    welfareOverview: 'Muhtasari wa ustawi',
    circleFallback: 'Mduara',
    noWelfare: 'Bado hakuna hazina za ustawi.',
  },
  profile: {
    eyebrow: 'Wewe',
    title: 'Wewe',
    subtitle: 'Jina, simu, na uthibitisho.',
    youFallback: 'Wewe',
    amanahScore: 'Alama ya Jameiyah',
    scoreExcellent: 'Imara',
    scoreStrong: 'Inaendelea',
    scoreBuilding: 'Inaanza',
    scoreHint: 'Ukamilifu wa wasifu wako wa Jameiyah',
    scoreNotCredit: 'Si alama ya benki au CRB',
    scoreStepPhone: 'Simu ya Kenya',
    scoreStepProfile: 'Jina kwenye wasifu',
    scoreStepDocs: 'Hati ya kitambulisho',
    scoreStepKyc: 'KYC imeidhinishwa',
    scoreNext: 'Angalia ufahamu wa akiba',
    appearance: 'Muonekano',
    linkMoney: 'Pesa',
    linkGoals: 'Malengo',
    linkVerification: 'Uthibitisho',
    linkZakat: 'Zakat',
    linkSupport: 'Msaada',
    onboardingEyebrow: 'Karibu tayari',
    onboardingTitle: 'Karibu Jameiyah',
    onboardingBody: 'Ongeza jina na simu ya Kenya kuanza.',
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
    mpesaHint: 'Hutumika kwa ongezeko na utoaji.',
    linking: 'Inaunganisha…',
    linkMpesa: 'Unganisha M-Pesa',
    documentType: 'Aina ya hati',
    fileHint: 'Picha au PDF · max ~10MB',
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
    referralHint: 'Inastahiki baada ya mchango wako wa kwanza uliolipwa.',
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
    emptyDesc: 'Mialiko, michango, na malipo huonekana hapa.',
    recentMoney: 'Pesa za hivi karibuni',
    openMoney: 'Pesa',
    openCircles: 'Miduara',
    openItem: 'Fungua',
  },
  support: {
    eyebrow: 'Saidia Jameiyah',
    title: 'Saidia Jameiyah',
    body: 'Tipu ya hiari kwa jukwaa — si sadaka.',
    tipLabel: 'Tipu (KES)',
    phoneOptional: 'Simu (si lazima)',
    submit: 'Tuma tipu',
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
    womensBlurb: 'Ulinzi na ustawi kwa miduara ya wanawake.',
    bodaBlurb: 'Akiba ya stage yenye ustawi kwa waendesha.',
    arrears: 'Malimbikizo',
    auditTrail: 'Rekodi ya ukaguzi',
    downloadPdf: 'Pakua PDF',
  },
  officer: {
    title: 'Dashibodi ya ofisa',
    auditEyebrow: 'Rekodi ya ukaguzi',
    auditIntro: 'Idhini mbili na mabadiliko ya hazina.',
    dualApprovalTrail: 'Maombi ya idhini mbili',
    noDualRequests: 'Bado hakuna maombi ya idhini mbili.',
    treasuryChanges: 'Hazina na vitabu',
    noTreasuryAudit: 'Bado hakuna rekodi za hazina.',
    allCircleAudit: 'Matukio yote ya ukaguzi wa mduara',
    arrearsEyebrow: 'Malimbikizo',
    arrearsIntro: 'Michango isiyolipwa kwa umri.',
    bucketCurrent: 'Ya sasa',
    bucket17: 'Siku 1–7',
    bucket830: 'Siku 8–30',
    bucket3160: 'Siku 31–60',
    bucket61: 'Siku 61+',
    bucketTotal: 'Jumla inayosubiri',
    autoFineTitle: 'Faini otomatiki',
    autoFineIntro: 'Baada ya neema, michango iliyochelewa hupata faini.',
    autoFineEnable: 'Washa faini otomatiki',
    graceDays: 'Siku za neema baada ya tarehe',
    saveAutoFine: 'Hifadhi',
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
    title: 'Ongeza Jameiyah kwenye kifaa chako',
    detailNative: 'Sakinisha Jameiyah kwa ufikiaji wa haraka kwenye simu au kompyuta.',
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
