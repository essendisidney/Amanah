'use client';

import { Button, Separator } from '@jamiya/ui';
import { signInWithGoogleAction } from '../actions/oauth-actions';

export function GoogleSignInButton({
  next = '/dashboard',
  label = 'Continue with Google',
}: {
  next?: string;
  label?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-center">
        <Separator className="absolute inset-x-0" />
        <span className="relative bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
          Or
        </span>
      </div>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full">
          <GoogleIcon />
          {label}
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.8 3.8 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.3H12z"
      />
    </svg>
  );
}
