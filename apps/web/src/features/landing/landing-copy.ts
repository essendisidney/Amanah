import type { Locale } from '@/i18n/config';

/**
 * Home page body copy in English and Kiswahili.
 * Kiswahili was drafted for Kenyan readers; have a native speaker review before big campaigns.
 */
const en = {
  navCircles: 'Circles',
  navPricing: 'Pricing',
  heroTitle: 'Save together. See every shilling. Stay riba-free.',
  heroLead:
    'Jameiyah is the digital home for Kenyan circles — merry-go-round, table banking, and savings. Officers replace the spreadsheet. Members see what they paid.',
  createCircle: 'Create a circle',
  joinWithCode: 'Join with a code',
  newHere: 'New here?',
  chips: ['No interest (riba)', 'Private to your circle', 'Phone, email, or Google', 'Member statements'],

  circlesEyebrow: 'Built for how circles already work',
  circlesTitle: 'One practice. Many names. Your chama, recorded.',
  circlesLead:
    "Merry-go-round, chama, jam'iyah, susu, esusu, tontine — communities have pooled money this way for generations. Jameiyah keeps that trust, and replaces the notebook.",
  circleTypes: [
    { title: 'Merry-go-round', body: 'Monthly contributions, payout turns, and a board that shows who has received the pot.' },
    {
      title: 'Table banking',
      body: 'Share buy-in, monthly savings, and loans. Paste past Excel records once names match, or enter one member at a time.',
    },
    { title: 'Savings', body: 'A contribution calendar and shared goals — school fees, a trip, a wedding — without a rotating pot.' },
    { title: 'Sadaka & zakat', body: 'Give in the open. Campaigns with receipts, and a zakat calculator that explains the nisab.' },
  ],
  openGiving: 'Open giving →',

  whoEyebrow: 'Who it is for',
  whoTitle: 'Officers run the books. Members see their own.',
  who: [
    {
      title: 'Circle officers',
      body: 'Invite by phone, record shares and monthly savings, import a past sheet, and export statements. The Excel file stays a backup, not the only book.',
    },
    {
      title: 'Members',
      body: 'Join with a code from WhatsApp, pay from Money, and open your statement. You see your circle — not everyone else’s private groups.',
    },
    {
      title: 'Mosques & campaigns',
      body: 'Publish a sadaka page, share a link, and give donors a receipt. Zakat stays a calculator, not a hidden fee.',
    },
  ],

  howEyebrow: 'How it works',
  howTitle: 'Circles, wallet, and trust — in one place',
  howLead: 'Create or join a savings circle, contribute on schedule, and keep every shilling visible to the people who share it.',
  steps: [
    { title: 'Start or join a circle', body: 'Merry-go-round, savings, or table banking — invite members with a link or code.' },
    { title: 'Contribute on time', body: 'Pay dues from your wallet, get reminders, and see who is current.' },
    { title: 'Grow with trust', body: 'Statements, officer tools, KYC, and audit trails keep community money clear.' },
  ],

  shariahLink: 'Full Shariah stance',
  shariahTail:
    '. Jameiyah is community software, not a bank and not an investment fund. We do not claim a regulator licence or a named Shariah board until one is appointed and published.',

  trustEyebrow: 'What serious platforms show — stated plainly',
  trustTitle: 'Trust you can check, not a slogan.',
  trust: [
    {
      q: 'Where does the money sit?',
      a: 'Circle records live in Jameiyah. Wallet top-ups use the payment providers configured for your account (such as M-Pesa or card). Officers still reconcile the circle bank account.',
    },
    {
      q: 'Who can see a payment?',
      a: 'Officers of that circle, and the member it belongs to. Other circles on the platform cannot open your books.',
    },
    {
      q: 'Can we bring last year’s Excel?',
      a: 'Yes for table banking. Paste the sheet, preview every name, and import only when each row matches a member. Nothing is skipped quietly.',
    },
    {
      q: 'What does it cost?',
      a: 'Group plans are listed in Kenyan shillings. A small circle can start free. Officers change the plan from the circle console.',
    },
  ],
  seePricing: 'See pricing',

  readyTitle: 'Ready for your circle?',
  readyLead: 'Sign in with phone SMS, email, or Google — and start in minutes.',

  footerPricing: 'Pricing',
  footerPrivacy: 'Privacy',
  footerTerms: 'Terms',

  mock: {
    kind: 'Merry-go-round',
    circle: 'Umoja Sisters',
    place: 'Mombasa · 12 members · Ksh 5,000 a month',
    pot: 'This round’s pot',
    paidOf: '9 of 12 paid',
    nextLabel: 'Next payout',
    paidOut: 'Paid out',
    you: 'You',
    more: '+7 more members',
    payCta: 'Pay Ksh 5,000 with M-Pesa',
    toastTitle: 'M-Pesa received',
    toastBody: 'Zawadi paid Ksh 5,000',
    statementTitle: 'Your statement',
    statementBody: 'All paid ✓ · 0% riba',
    caption: 'Example circle',
    months: { jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov' },
  },
};

export type LandingCopy = typeof en;

const sw: LandingCopy = {
  navCircles: 'Vikundi',
  navPricing: 'Bei',
  heroTitle: 'Wekeni akiba pamoja. Oneni kila shilingi. Bila riba.',
  heroLead:
    'Jameiyah ni makao ya kidijitali ya vikundi vya Kenya — merry-go-round, table banking na akiba. Viongozi hawahitaji tena daftari la Excel. Wanachama wanaona walichochanga.',
  createCircle: 'Anzisha kikundi',
  joinWithCode: 'Jiunge kwa msimbo',
  newHere: 'Mgeni hapa?',
  chips: ['Bila riba', 'Faragha ya kikundi chako', 'Simu, barua pepe au Google', 'Taarifa za wanachama'],

  circlesEyebrow: 'Imejengwa jinsi vikundi vinavyofanya kazi tayari',
  circlesTitle: 'Desturi moja. Majina mengi. Chama chako, kwenye rekodi.',
  circlesLead:
    "Merry-go-round, chama, jam'iyah, susu, esusu, tontine — jamii zimechangishana pesa hivi kwa vizazi. Jameiyah inalinda uaminifu huo, na inachukua nafasi ya daftari.",
  circleTypes: [
    { title: 'Merry-go-round', body: 'Michango ya kila mwezi, zamu za kupokea, na ubao unaoonyesha nani ameshapokea mchango.' },
    {
      title: 'Table banking',
      body: 'Hisa za kujiunga, akiba ya kila mwezi, na mikopo. Bandika rekodi za zamani za Excel majina yakishalingana, au weka mwanachama mmoja mmoja.',
    },
    { title: 'Akiba', body: 'Kalenda ya michango na malengo ya pamoja — karo ya shule, safari, harusi — bila mzunguko wa kupokea.' },
    { title: 'Sadaka na zaka', body: 'Toa kwa uwazi. Kampeni zenye risiti, na kikokotoo cha zaka kinachoeleza nisab.' },
  ],
  openGiving: 'Nenda kwenye sadaka →',

  whoEyebrow: 'Ni kwa ajili ya nani',
  whoTitle: 'Viongozi wanasimamia vitabu. Wanachama wanaona vyao.',
  who: [
    {
      title: 'Viongozi wa kikundi',
      body: 'Alika kwa namba ya simu, rekodi hisa na akiba ya kila mwezi, leta karatasi ya zamani, na toa taarifa. Faili la Excel linabaki kuwa nakala ya ziada, si kitabu pekee.',
    },
    {
      title: 'Wanachama',
      body: 'Jiunge kwa msimbo kutoka WhatsApp, lipa kutoka Pesa, na fungua taarifa yako. Unaona kikundi chako — si vikundi binafsi vya watu wengine.',
    },
    {
      title: 'Misikiti na kampeni',
      body: 'Chapisha ukurasa wa sadaka, shiriki kiungo, na mpe kila mtoaji risiti. Zaka inabaki kuwa kikokotoo, si ada iliyofichwa.',
    },
  ],

  howEyebrow: 'Jinsi inavyofanya kazi',
  howTitle: 'Vikundi, pochi na uaminifu — mahali pamoja',
  howLead: 'Anzisha au jiunge na kikundi cha akiba, changia kwa ratiba, na weka kila shilingi wazi kwa wote wanaohusika.',
  steps: [
    { title: 'Anzisha au jiunge na kikundi', body: 'Merry-go-round, akiba au table banking — alika wanachama kwa kiungo au msimbo.' },
    { title: 'Changia kwa wakati', body: 'Lipa michango kutoka kwenye pochi yako, pata vikumbusho, na uone nani amelipa.' },
    { title: 'Kueni kwa uaminifu', body: 'Taarifa, zana za viongozi, KYC na kumbukumbu za ukaguzi zinaweka pesa za jamii wazi.' },
  ],

  shariahLink: 'Msimamo kamili wa Shariah',
  shariahTail:
    '. Jameiyah ni programu ya jamii, si benki wala mfuko wa uwekezaji. Hatudai leseni ya mdhibiti wala bodi ya Shariah hadi itakapoteuliwa na kutangazwa.',

  trustEyebrow: 'Kile majukwaa makini huonyesha — kwa uwazi',
  trustTitle: 'Uaminifu unaoweza kuukagua, si kauli mbiu.',
  trust: [
    {
      q: 'Pesa inakaa wapi?',
      a: 'Rekodi za kikundi ziko ndani ya Jameiyah. Kuweka pesa kwenye pochi kunatumia watoa huduma za malipo waliowekwa kwa akaunti yako (kama M-Pesa au kadi). Viongozi bado wanalinganisha akaunti ya benki ya kikundi.',
    },
    {
      q: 'Nani anaweza kuona malipo?',
      a: 'Viongozi wa kikundi hicho, na mwanachama anayehusika. Vikundi vingine kwenye jukwaa haviwezi kufungua vitabu vyenu.',
    },
    {
      q: 'Tunaweza kuleta Excel ya mwaka jana?',
      a: 'Ndiyo, kwa table banking. Bandika karatasi, kagua kila jina, na ingiza tu kila safu inapolingana na mwanachama. Hakuna kinachorukwa kimyakimya.',
    },
    {
      q: 'Inagharimu kiasi gani?',
      a: 'Mipango ya vikundi imeorodheshwa kwa shilingi za Kenya. Kikundi kidogo kinaweza kuanza bure. Viongozi hubadilisha mpango kutoka kwenye ukurasa wa viongozi wa kikundi.',
    },
  ],
  seePricing: 'Angalia bei',

  readyTitle: 'Kikundi chako kiko tayari?',
  readyLead: 'Ingia kwa SMS ya simu, barua pepe au Google — na uanze kwa dakika chache.',

  footerPricing: 'Bei',
  footerPrivacy: 'Faragha',
  footerTerms: 'Masharti',

  mock: {
    kind: 'Merry-go-round',
    circle: 'Umoja Sisters',
    place: 'Mombasa · wanachama 12 · Ksh 5,000 kwa mwezi',
    pot: 'Mchango wa zamu hii',
    paidOf: 'Wamelipa 9 kati ya 12',
    nextLabel: 'Anayepokea ijayo',
    paidOut: 'Amepokea',
    you: 'Wewe',
    more: '+ wanachama 7 zaidi',
    payCta: 'Lipa Ksh 5,000 kwa M-Pesa',
    toastTitle: 'M-Pesa imepokelewa',
    toastBody: 'Zawadi amelipa Ksh 5,000',
    statementTitle: 'Taarifa yako',
    statementBody: 'Umelipa yote ✓ · Bila riba',
    caption: 'Kikundi cha mfano',
    months: { jul: 'Jul', aug: 'Ago', sep: 'Sep', oct: 'Okt', nov: 'Nov' },
  },
};

export function landingCopy(locale: Locale): LandingCopy {
  return locale === 'sw' ? sw : en;
}
