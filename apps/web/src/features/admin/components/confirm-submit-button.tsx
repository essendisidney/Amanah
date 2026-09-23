'use client';

import { Button } from '@jamiya/ui';

export function ConfirmSubmitButton({
  children,
  message,
  variant = 'default',
  size = 'sm',
  className,
}: {
  children: React.ReactNode;
  message: string;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}
