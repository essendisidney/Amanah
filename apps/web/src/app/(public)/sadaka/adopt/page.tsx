import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { formatCurrency } from '@jamiya/shared';
import { Button, Input, Label, Textarea } from '@jamiya/ui';
import {
  createAdoptionProfileFormAction,
  registerInstitutionFormAction,
  startSponsorshipFormAction,
} from '@/features/charity/actions';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Adopt a mosque / madrasa / orphanage' };
export const dynamic = 'force-dynamic';

type Profile = {
  id: string;
  slug: string;
  title: string;
  description: string;
  suggested_monthly_amount: number | string;
  currency: string;
  institution: { name: string; type: string; verification_status: string } | null;
};

export default async function AdoptPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: myInstitutions }] = await Promise.all([
    supabase
      .from('adoption_profiles')
      .select(
        'id, slug, title, description, suggested_monthly_amount, currency, institution:sadaka_institutions(name, type, verification_status)',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    user
      ? supabase
          .from('sadaka_institutions')
          .select('id, name, type, verification_status')
          .eq('contact_user_id', user.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const rows = (profiles ?? []) as unknown as Profile[];
  const institutions = (myInstitutions ?? []) as Array<{
    id: string;
    name: string;
    type: string;
    verification_status: string;
  }>;
  const verifiedMine = institutions.filter((i) => i.verification_status === 'verified');

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent">Sadaka</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
          Adopt an institution
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Recurring sponsorship for mosques, madrasas, and orphanages. Stricter KYC than individual
          campaigns. First month is recorded now; live recurring STK comes with Daraja.
        </p>
        <p className="mt-4 text-sm">
          <Link href={'/sadaka' as Route} className="text-accent hover:underline">
            ← Individual campaigns
          </Link>
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Open for adoption
        </h2>
        {rows.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((row) => {
              const monthly = Number(row.suggested_monthly_amount);
              return (
                <li key={row.id} className="space-y-3 px-5 py-5">
                  <div>
                    <h3 className="font-semibold">{row.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.institution?.name} · {row.institution?.type?.replaceAll('_', ' ')} ·
                      suggested {formatCurrency(monthly, row.currency)}/month
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{row.description}</p>
                  </div>
                  {user ? (
                    <form action={startSponsorshipFormAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="profileId" value={row.id} />
                      <Input
                        name="monthlyAmount"
                        type="number"
                        min={100}
                        defaultValue={monthly}
                        className="w-32"
                        required
                      />
                      <Input name="phone" type="tel" placeholder="+2547…" className="w-40" />
                      <Button type="submit" size="sm">
                        Sponsor (sim first month)
                      </Button>
                    </form>
                  ) : (
                    <Link href={`/login?next=/sadaka/adopt` as Route} className="text-sm text-accent">
                      Sign in to sponsor
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active adoption profiles yet.</p>
        )}
      </section>

      {user ? (
        <>
          <section className="space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              Register your institution
            </h2>
            <form
              action={registerInstitutionFormAction}
              className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5"
            >
              <div className="space-y-1">
                <Label htmlFor="name">Institution name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  className="h-10 w-full border border-input bg-background px-3"
                  defaultValue="mosque"
                >
                  <option value="mosque">Mosque</option>
                  <option value="madrasa">Madrasa</option>
                  <option value="orphanage">Orphanage</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactPerson">Contact person</Label>
                <Input id="contactPerson" name="contactPerson" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input id="contactPhone" name="contactPhone" type="tel" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="registrationDocUrl">Registration documents URL</Label>
                <Input id="registrationDocUrl" name="registrationDocUrl" required />
              </div>
              <Button type="submit">Submit for verification</Button>
            </form>
            {institutions.length ? (
              <ul className="text-sm text-muted-foreground">
                {institutions.map((i) => (
                  <li key={i.id}>
                    {i.name} · {i.type} · {i.verification_status}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {verifiedMine.length ? (
            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                Create adoption profile
              </h2>
              <form
                action={createAdoptionProfileFormAction}
                className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="space-y-1">
                  <Label htmlFor="institutionId">Institution</Label>
                  <select
                    id="institutionId"
                    name="institutionId"
                    className="h-10 w-full border border-input bg-background px-3"
                    required
                  >
                    {verifiedMine.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="title">Need title</Label>
                  <Input id="title" name="title" placeholder="Monthly feeding program" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={3} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="monthlyAmount">Suggested monthly (KES)</Label>
                  <Input
                    id="monthlyAmount"
                    name="monthlyAmount"
                    type="number"
                    min={100}
                    defaultValue={500}
                    required
                  />
                </div>
                <Button type="submit">Publish profile</Button>
              </form>
            </section>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href={'/login?next=/sadaka/adopt' as Route} className="text-accent hover:underline">
            Sign in
          </Link>{' '}
          to register an institution or sponsor.
        </p>
      )}
    </main>
  );
}
