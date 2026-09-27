/** Where a member payment should land. Only Pay stays on Pay; everything else returns to the circle. */
export function payReturnPath(returnTo: string | null | undefined): '/pay' | null {
  return returnTo?.trim() === '/pay' ? '/pay' : null;
}
