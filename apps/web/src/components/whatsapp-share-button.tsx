'use client';

import type { ComponentProps } from 'react';
import { Button } from '@jamiya/ui';
import { cn } from '@/lib/utils';
import { whatsappShareHref } from '@/lib/whatsapp-share';

type ButtonProps = ComponentProps<typeof Button>;

type Props = {
  /** Prefill text for the WhatsApp share sheet. */
  text: string;
  label?: string;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
};

/** Opens WhatsApp with a prefilled message (works on mobile + desktop wa.me). */
export function WhatsAppShareButton({
  text,
  label = 'WhatsApp',
  className,
  variant = 'outline',
  size = 'default',
}: Props) {
  return (
    <Button type="button" variant={variant} size={size} className={cn('min-h-11', className)} asChild>
      <a href={whatsappShareHref(text)} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Button>
  );
}
