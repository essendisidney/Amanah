import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@jamiya/shared';
import { WelcomeIntentForm, type WelcomeIntentLabels } from '@/features/auth/components/welcome-intent-form';
import { getDictionary } from '@/i18n/get-dictionary';

export const metadata: Metadata = {
  title: 'Welcome',
};

const COPY = {
  en: {
    eyebrow: `Welcome to ${APP_NAME}`,
    title: ['Save together.', 'Build together.', 'Prosper together.'],
    lead: 'What brings you to Jameiyah today?',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    createEmail: 'Create email account',
    intents: {
      family: 'Save with my family',
      join: 'Join a savings circle',
      build: 'Build my savings',
      manage: 'Manage my money',
      business: 'Create a business circle',
      continue: 'Continue',
    },
  },
  sw: {
    eyebrow: `Karibu ${APP_NAME}`,
    title: ['Wekeni akiba pamoja.', 'Jengeni pamoja.', 'Fanikiweni pamoja.'],
    lead: 'Nini kimekuleta Jameiyah leo?',
    haveAccount: 'Tayari una akaunti?',
    signIn: 'Ingia',
    createEmail: 'Fungua akaunti kwa barua pepe',
    intents: {
      family: 'Weka akiba na familia yangu',
      join: 'Jiunge na kikundi cha akiba',
      build: 'Jenga akiba yangu',
      manage: 'Simamia pesa zangu',
      business: 'Anzisha kikundi cha biashara',
      continue: 'Endelea',
    },
  },
} satisfies Record<string, { intents: WelcomeIntentLabels } & Record<string, unknown>>;

export default async function WelcomePage() {
  const { locale } = await getDictionary();
  const c = locale === 'sw' ? COPY.sw : COPY.en;

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{c.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {c.title[0]}
          <br />
          {c.title[1]}
          <br />
          {c.title[2]}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.lead}</p>
      </div>
      <WelcomeIntentForm labels={c.intents} />
      <p className="text-center text-sm text-muted-foreground">
        {c.haveAccount}{' '}
        <Link href="/login" className="-my-2.5 inline-block py-2.5 font-semibold text-primary hover:underline">
          {c.signIn}
        </Link>
        {' · '}
        <Link href="/register" className="-my-2.5 inline-block py-2.5 font-semibold text-primary hover:underline">
          {c.createEmail}
        </Link>
      </p>
    </div>
  );
}
