import type { ReactNode } from 'react';

export function AuthFormMessage({ children }: { children: ReactNode }) {
  return <p className="text-center text-sm text-muted-foreground">{children}</p>;
}
