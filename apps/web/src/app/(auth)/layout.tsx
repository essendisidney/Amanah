import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@jamiya/shared';

export const metadata: Metadata = {
  title: 'Account',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_transparent_50%),linear-gradient(180deg,_#fbfcfa_0%,_#eef5f0_100%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8">
        <Link
          href="/"
          className="mb-10 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-primary"
        >
          {APP_NAME}
        </Link>
        <div className="flex flex-1 items-start justify-center md:items-center">{children}</div>
      </div>
    </div>
  );
}
