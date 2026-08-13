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
  dashboard: {
    eyebrow: string;
    greeting: string;
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
  };
  circles: {
    eyebrow: string;
    title: string;
    subtitle: string;
    createCircle: string;
    emptyTitle: string;
    emptyDesc: string;
    createACircle: string;
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
    failedPayments: string;
    historyTitle: string;
    historyEmpty: string;
  };
  walletForms: {
    amount: string;
    mpesaPhone: string;
    paystackHint: string;
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
  };
  finance: {
    eyebrow: string;
    title: string;
    subtitle: string;
    welfareTitle: string;
    welfareDesc: string;
    qardTitle: string;
    qardDesc: string;
    tawarruqTitle: string;
    tawarruqDesc: string;
    goalsTitle: string;
    goalsDesc: string;
    welfareOverview: string;
    circleFallback: string;
    noWelfare: string;
  };
  profile: {
    eyebrow: string;
    title: string;
    subtitle: string;
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
    signOutHint: 'End your session on this phone.',
    support: 'Support',
    notifications: 'Notifications',
    admin: 'Admin',
    language: 'Language',
    viewAll: 'View all',
    createCircle: 'Create circle',
    backToDashboard: 'Back to dashboard',
    home: 'Home',
    members: 'members',
    cycle: 'Cycle',
    starts: 'Starts',
    perCycle: 'per cycle',
    pay: 'Pay',
    left: 'left',
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
  dashboard: {
    eyebrow: 'Member home',
    greeting: 'Assalamu alaikum',
    subtitle: 'Track circles, dues, and payout turns.',
    completeProfileHint: ' Complete your profile to unlock invitations and KYC.',
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
  },
  circles: {
    eyebrow: 'Circles',
    title: 'My circles',
    subtitle: 'All rotating savings circles linked to your account.',
    createCircle: 'Create circle',
    emptyTitle: 'You have not joined a circle yet',
    emptyDesc: 'Create a new circle or wait for an invitation from your community.',
    createACircle: 'Create a circle',
  },
  wallet: {
    eyebrow: 'Balances',
    title: 'Wallet',
    subtitle: 'Top up to pay contributions. Payouts credit here when cycles settle.',
    emptyTitle: 'No wallet found',
    emptyDesc: 'A default wallet is created automatically when your profile is provisioned.',
    totalBalance: 'Total balance {amount}',
    topUp: 'Top up',
    withdraw: 'Withdraw',
    paymentsInProgress: 'Payments in progress',
    failedPayments: 'Failed payments — retry',
    historyTitle: 'Transaction history',
    historyEmpty:
      'No ledger entries yet. Top-ups, contributions, and payouts will appear here.',
  },
  walletForms: {
    amount: 'Amount ({currency})',
    mpesaPhone: 'M-Pesa phone',
    paystackHint:
      'Pay with Paystack Checkout (card, M-Pesa mobile money, bank). You will be redirected to complete payment securely.',
    bankHint: 'Bank top-up creates a pending intent for settlement against your bank flow.',
    simulatedHint:
      'Instant demo wallet credit (no M-Pesa). Use this to pay dues, fund pockets, and repay loans while testing.',
    processing: 'Processing…',
    payMpesa: 'Pay with M-Pesa',
    payPaystack: 'Pay with Paystack',
    startBank: 'Start bank top-up',
    topUpWallet: 'Top up wallet',
    bank: 'Bank',
    bankName: 'Bank name',
    accountName: 'Account name',
    accountNumber: 'Account number',
    submitting: 'Submitting…',
    requestWithdrawal: 'Request withdrawal',
    retry: 'Retry',
    retrying: 'Retrying…',
  },
  finance: {
    eyebrow: 'Circle finance',
    title: 'Finance',
    subtitle: 'Manage Sharia-conscious finance tools connected to your circles.',
    welfareTitle: 'Welfare fund',
    welfareDesc: 'Medical, funeral, and accident support for your circle.',
    qardTitle: 'Qard Hassan',
    qardDesc: 'Request and repay interest-free circle loans.',
    tawarruqTitle: 'Tawarruq',
    tawarruqDesc: 'Apply for partner-facilitated Sharia-compliant finance.',
    goalsTitle: 'Savings goals',
    goalsDesc: 'Save for Hajj, Umra, Udhiyah, or any personal target.',
    welfareOverview: 'Welfare overview',
    circleFallback: 'Circle',
    noWelfare: 'Your circles have no welfare funds yet.',
  },
  profile: {
    eyebrow: 'Account',
    title: 'Profile',
    subtitle: 'Keep your details current and submit KYC documents for compliance review.',
    personalDetails: 'Personal details',
    email: 'Email: {email}',
    mpesaLinkage: 'M-Pesa linkage',
    kycDocuments: 'KYC documents',
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
    fileHint: 'File (JPEG, PNG, WebP, or PDF · max 10MB)',
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
    eyebrow: 'Inbox',
    title: 'Notifications',
    unreadOne: '{count} unread message',
    unreadMany: '{count} unread messages',
    upToDate: 'You are up to date.',
    markAllRead: 'Mark all as read',
    markRead: 'Mark read',
    emptyTitle: 'No notifications yet',
    emptyDesc: 'Circle invites, contribution reminders, and payout updates will appear here.',
  },
  support: {
    eyebrow: 'Keep Amanah growing',
    title: 'Support the Amanah platform',
    body: "This is a voluntary tip to sustain Amanah's technology, support, and community operations. It is not sadaka and does not fund a charity campaign.",
    tipLabel: 'Platform tip (KES)',
    phoneOptional: 'Phone (optional)',
    submit: 'Support Amanah',
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
  dashboard: {
    eyebrow: 'Nyumbani kwa mwanachama',
    greeting: 'Assalamu alaikum',
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
  },
  circles: {
    eyebrow: 'Miduara',
    title: 'Miduara yangu',
    subtitle: 'Miduara yote ya akiba inayozunguka iliyounganishwa na akaunti yako.',
    createCircle: 'Unda mduara',
    emptyTitle: 'Bado hujajiunga na mduara',
    emptyDesc: 'Unda mduara mpya au subiri mwaliko kutoka jamii yako.',
    createACircle: 'Unda mduara',
  },
  wallet: {
    eyebrow: 'Salio',
    title: 'Pochi',
    subtitle:
      'Ongeza pesa kulipa michango. Malipo ya mizunguko yanawekwa hapa yanapokamilika.',
    emptyTitle: 'Hakuna pochi',
    emptyDesc: 'Pochi chaguomsingi inaundwa kiotomatiki wasifu wako unapoundwa.',
    totalBalance: 'Salio jumla {amount}',
    topUp: 'Ongeza pesa',
    withdraw: 'Toa',
    paymentsInProgress: 'Malipo yanayoendelea',
    failedPayments: 'Malipo yaliyoshindikana — jaribu tena',
    historyTitle: 'Historia ya miamala',
    historyEmpty:
      'Bado hakuna rekodi. Ongezeko, michango, na malipo yataonekana hapa.',
  },
  walletForms: {
    amount: 'Kiasi ({currency})',
    mpesaPhone: 'Simu ya M-Pesa',
    paystackHint:
      'Lipa kwa Paystack Checkout (kadi, M-Pesa, benki). Utaelekezwa kukamilisha malipo salama.',
    bankHint: 'Ongezeko la benki linaunda ombi linalosubiri kuthibitishwa katika mtiririko wa benki.',
    simulatedHint:
      'Salio la majaribio papo hapo (bila M-Pesa). Tumia kulipa michango, kujaza hazina, na kulipa mikopo wakati wa majaribio.',
    processing: 'Inashughulikia…',
    payMpesa: 'Lipa kwa M-Pesa',
    payPaystack: 'Lipa kwa Paystack',
    startBank: 'Anza ongezeko la benki',
    topUpWallet: 'Ongeza pesa kwenye pochi',
    bank: 'Benki',
    bankName: 'Jina la benki',
    accountName: 'Jina la akaunti',
    accountNumber: 'Nambari ya akaunti',
    submitting: 'Inawasilisha…',
    requestWithdrawal: 'Omba kutoa pesa',
    retry: 'Jaribu tena',
    retrying: 'Inajaribu tena…',
  },
  finance: {
    eyebrow: 'Fedha za mduara',
    title: 'Fedha',
    subtitle: 'Simamia zana za fedha zinazofuata sheria za Kiislamu katika miduara yako.',
    welfareTitle: 'Hazina ya ustawi',
    welfareDesc: 'Msaada wa matibabu, mazishi, na ajali kwa mduara wako.',
    qardTitle: 'Qard Hassan',
    qardDesc: 'Omba na lipa mikopo ya mduara bila riba.',
    tawarruqTitle: 'Tawarruq',
    tawarruqDesc: 'Omba fedha zinazofuata Sharia kupitia washirika.',
    goalsTitle: 'Malengo ya akiba',
    goalsDesc: 'Okoa kwa Hajj, Umra, Udhiyah, au lengo lolote la kibinafsi.',
    welfareOverview: 'Muhtasari wa ustawi',
    circleFallback: 'Mduara',
    noWelfare: 'Miduara yako bado haina hazina za ustawi.',
  },
  profile: {
    eyebrow: 'Akaunti',
    title: 'Wasifu',
    subtitle: 'Weka taarifa zako sawa na wasilisha hati za KYC kwa ukaguzi wa uzingatiaji.',
    personalDetails: 'Taarifa binafsi',
    email: 'Barua pepe: {email}',
    mpesaLinkage: 'Uunganishaji wa M-Pesa',
    kycDocuments: 'Hati za KYC',
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
    fileHint: 'Faili (JPEG, PNG, WebP, au PDF · max 10MB)',
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
    eyebrow: 'Kikasha',
    title: 'Arifa',
    unreadOne: 'Ujumbe {count} haujasomwa',
    unreadMany: 'Ujumbe {count} haujasomwa',
    upToDate: 'Uko sawa.',
    markAllRead: 'Weka zote kama zimesomwa',
    markRead: 'Weka imesomwa',
    emptyTitle: 'Bado hakuna arifa',
    emptyDesc: 'Mialiko ya miduara, vikumbusho vya michango, na sasisho za malipo vitaonekana hapa.',
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
