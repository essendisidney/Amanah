import type { SVGProps } from 'react';

/** Lucide-style camel for Save — culturally fitting for Amanah. */
export function CamelIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {/* body + single hump */}
      <path d="M5 16c0-2.2 1.2-4 3.2-4.8L10 10.5V9c0-1 .6-1.8 1.5-2.2L14 5.5l1.2.8c.5.3.8.9.8 1.5v2.2" />
      <path d="M16 10c1.5.2 2.8 1.2 3.4 2.6L21 15" />
      <path d="M8.5 11.2c1.2-.4 2.5-.2 3.5.6l1.2.9c.7.5 1.6.7 2.4.5" />
      {/* legs */}
      <path d="M7.5 19v-3" />
      <path d="M11 19v-4" />
      <path d="M15 19v-4.5" />
      <path d="M18 19v-3.5" />
      {/* head cue */}
      <path d="M14 5.5c.4-.6 1.2-.8 1.8-.4" />
    </svg>
  );
}
