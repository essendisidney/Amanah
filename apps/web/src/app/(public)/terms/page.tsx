import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of use · Jameiyah',
  description: 'The terms for using Jameiyah, the community finance app by Jameiyah Limited.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="30 September 2026"
      lead="These terms apply when you use jameiyah.com and the Jameiyah app, run by Jameiyah Limited. By creating an account you agree to them."
      sections={[
        {
          title: 'What Jameiyah is',
          body: (
            <p>
              Jameiyah is software that helps groups run savings circles, table banking, welfare
              funds and giving campaigns. Jameiyah is not a bank, a SACCO or an investment fund,
              and it does not guarantee returns or cover losses between members.
            </p>
          ),
        },
        {
          title: 'Your account',
          body: (
            <>
              <p>
                You must be 18 or older and give true details. Keep your phone and sign-in codes
                private. You are responsible for what happens under your account.
              </p>
              <p>We may ask you to verify your identity before you can move money.</p>
            </>
          ),
        },
        {
          title: 'Circles and officers',
          body: (
            <p>
              Each circle sets its own rules: contribution amounts, payout order, fines, loan
              terms and any profit on loans. Officers are responsible for recording payments
              correctly and for the decisions of their circle. Jameiyah records what the circle
              agrees; it is not a party to agreements between members.
            </p>
          ),
        },
        {
          title: 'Money and payments',
          body: (
            <>
              <p>
                Payments run through M-Pesa, card and bank providers. Their own terms and charges
                also apply. Circle funds are held in the circle&apos;s own bank or M-Pesa account
                unless your circle uses a Jameiyah wallet.
              </p>
              <p>
                Fees are shown before you pay and are listed on the pricing page. Completed
                payments can only be reversed where the provider allows it.
              </p>
            </>
          ),
        },
        {
          title: 'Acceptable use',
          body: (
            <p>
              Do not use Jameiyah for fraud, money laundering, unlicensed deposit-taking or
              lending to the public, or to harass other members. Sadaka campaigns must be true
              and for the stated beneficiary. We may suspend accounts or campaigns that break
              these rules or the law.
            </p>
          ),
        },
        {
          title: 'Disputes between members',
          body: (
            <p>
              Members can raise a dispute in the app. Officers resolve disputes within the
              circle; Jameiyah can help by sharing the records we hold, but the circle&apos;s own
              rules decide the outcome.
            </p>
          ),
        },
        {
          title: 'Availability and liability',
          body: (
            <p>
              We work to keep Jameiyah available and accurate, but the service is provided as it
              is. To the extent the law allows, Jameiyah Limited is not liable for losses caused
              by members, officers, payment providers or events outside our control.
            </p>
          ),
        },
        {
          title: 'Changes, ending and law',
          body: (
            <>
              <p>
                We may update these terms and will post changes here. You can close your account
                at any time; circle records you are part of stay with the circle.
              </p>
              <p>These terms are governed by the laws of Kenya.</p>
            </>
          ),
        },
      ]}
    />
  );
}
