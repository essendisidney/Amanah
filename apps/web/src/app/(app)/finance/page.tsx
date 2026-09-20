import { redirect } from 'next/navigation';

/** Finance lives under Money — keep deep links working. */
export default function FinancePage() {
  redirect('/wallet#more');
}
