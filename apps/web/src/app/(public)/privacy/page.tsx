import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy · Jameiyah',
  description: 'How Jameiyah Limited collects, uses and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="30 September 2026"
      lead="Jameiyah Limited runs jameiyah.com. This policy explains what personal data we collect when you use Jameiyah, why we collect it, who we share it with, and the rights you have under Kenya's Data Protection Act, 2019."
      sections={[
        {
          title: 'Who we are',
          body: (
            <p>
              Jameiyah Limited, a company registered in Kenya, is the data controller for
              personal data processed through Jameiyah. Jameiyah is community software for
              savings circles, table banking and giving. It is not a bank.
            </p>
          ),
        },
        {
          title: 'What we collect',
          body: (
            <>
              <p>
                <strong>Account details:</strong> your name, phone number, email address (if you
                sign in with email or Google), date of birth and profile photo.
              </p>
              <p>
                <strong>Identity details:</strong> your national ID number and the documents you
                upload for verification. We check your ID number against the government IPRS
                register to confirm your identity.
              </p>
              <p>
                <strong>Money records:</strong> the circles you belong to, your contributions,
                payouts, loans, repayments, wallet top-ups and withdrawals, donations, and your
                M-Pesa or bank details for payouts.
              </p>
              <p>
                <strong>Circle records:</strong> next of kin, votes, meeting notes and messages you
                add inside a circle.
              </p>
              <p>
                <strong>Technical data:</strong> device and browser type, IP address, and activity
                logs we keep for security and audit.
              </p>
            </>
          ),
        },
        {
          title: 'Why we use it',
          body: (
            <>
              <p>We use your data to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>create your account and sign you in;</li>
                <li>verify your identity and prevent fraud;</li>
                <li>run your circles, keep their books and produce statements;</li>
                <li>process payments, payouts and donations;</li>
                <li>send reminders and notices by SMS, email, WhatsApp or push;</li>
                <li>handle support requests and disputes;</li>
                <li>meet our legal and regulatory obligations.</li>
              </ul>
              <p>
                We rely on performing our agreement with you, your consent where we ask for it,
                our legitimate interest in keeping the service safe, and legal obligations.
              </p>
            </>
          ),
        },
        {
          title: 'Who can see your data',
          body: (
            <>
              <p>
                Officers of a circle can see the records of members in that circle. Other members
                see their own records and circle-level totals. Other circles cannot see your
                circle.
              </p>
              <p>
                We share data with service providers who help run Jameiyah, only as far as they
                need it: Safaricom (M-Pesa), IntaSend and Paystack (payments), our partner banks
                (payouts), Taifa Mobile (SMS), Resend (email), Supabase and Vercel (hosting and
                database), and the IPRS register (identity checks). We also share data where the
                law requires it.
              </p>
              <p>We do not sell your personal data.</p>
            </>
          ),
        },
        {
          title: 'Where your data is stored',
          body: (
            <p>
              Our database is hosted in the European Union (Ireland). Where data leaves Kenya, we
              rely on providers that apply safeguards consistent with the Data Protection Act.
            </p>
          ),
        },
        {
          title: 'How long we keep it',
          body: (
            <p>
              We keep your account data while your account is open. We keep money and circle
              records for as long as the law requires after an account closes, because circle
              books and payment records must stay complete for other members and for audit.
            </p>
          ),
        },
        {
          title: 'Your rights',
          body: (
            <>
              <p>Under the Data Protection Act you can ask us to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>tell you what data we hold about you and give you a copy;</li>
                <li>correct data that is wrong;</li>
                <li>delete data we no longer need, unless we must keep it by law;</li>
                <li>stop or limit certain uses of your data;</li>
                <li>withdraw consent you gave earlier.</li>
              </ul>
              <p>
                You can also complain to the Office of the Data Protection Commissioner (ODPC).
              </p>
            </>
          ),
        },
        {
          title: 'Security',
          body: (
            <p>
              Data is encrypted in transit. Access is limited by role, sensitive actions need
              dual approval, and we keep audit logs of changes to money records.
            </p>
          ),
        },
        {
          title: 'Changes and contact',
          body: (
            <p>
              We will post changes to this policy on this page and tell you in the app when a
              change is significant. To use your rights or ask a question, contact us through
              the support page.
            </p>
          ),
        },
      ]}
    />
  );
}
