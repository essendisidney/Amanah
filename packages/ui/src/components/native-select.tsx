import * as React from 'react';
import { cn } from '../lib/utils';

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Styled native `<select>` that matches `Input` (height, radius, border,
 * background, focus ring, disabled state). The chevron is drawn with two
 * `currentColor` gradients so it follows the text colour in light and dark
 * themes without an extra wrapper element or icon dependency.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, multiple, ...props }, ref) => {
    return (
      <select
        className={cn(
          'border-input bg-card text-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full appearance-none rounded-lg border py-2 pl-3 text-sm shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:[color-scheme:dark]',
          multiple
            ? 'h-auto pr-3'
            : 'bg-[image:linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] bg-[length:5px_5px] bg-[position:calc(100%-1.125rem)_50%,calc(100%-0.8125rem)_50%] bg-no-repeat pr-9',
          className,
        )}
        multiple={multiple}
        ref={ref}
        {...props}
      />
    );
  },
);
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
