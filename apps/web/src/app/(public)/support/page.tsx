import { Button, Input, Label } from '@jamiya/ui';
import { tipFormAction } from '@/features/charity/actions';

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Keep Amanah growing</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight">Support the Amanah platform</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">This is a voluntary tip to sustain Amanah&apos;s technology, support, and community operations. It is not sadaka and does not fund a charity campaign.</p>
      <form action={tipFormAction} className="mt-10 max-w-md space-y-5 border border-border bg-card p-6">
        <div className="space-y-2"><Label htmlFor="amount">Platform tip (KES)</Label><Input id="amount" name="amount" type="number" min="10" step="10" required /></div>
        <div className="space-y-2"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" name="phone" type="tel" placeholder="+254712345678" /></div>
        <Button type="submit">Support Amanah</Button>
      </form>
    </main>
  );
}
