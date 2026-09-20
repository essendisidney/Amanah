import { APP_NAME } from '@jamiya/shared';

/** Same credit line as Marit Events: © year Brand · Digital solution by Pesara Limited */
export function PesaraCredit({ className = '' }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <p className={`text-xs tracking-[0.12em] text-[#7a8f86] ${className}`.trim()}>
      © {year} {APP_NAME}
      <span className="mx-2 text-[#7a8f86]/50">·</span>
      Digital solution by Pesara Limited
    </p>
  );
}
