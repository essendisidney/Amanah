import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@jamiya/ui';
import type { ReactNode } from 'react';

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-md border-border/80 shadow-sm">
      <CardHeader>
        {/* The card title is the page's heading, so it is the h1 (CardTitle renders an h3). */}
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tracking-tight">
          {title}
        </h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
