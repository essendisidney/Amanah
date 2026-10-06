import { redirect } from 'next/navigation';

/** Loans, goals and giving live under Services — keep old /finance links working. */
export default function FinancePage() {
  redirect('/services');
}
