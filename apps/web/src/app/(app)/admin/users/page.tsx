import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { updateUserRoleAction } from '@/features/admin/actions/admin-actions';
import { StatusBadge } from '@/features/dashboard/components/dashboard-stats';
import { Button } from '@jamiya/ui';

export const metadata: Metadata = { title: 'Admin · Users' };
export const dynamic = 'force-dynamic';

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  platform_role: string;
  kyc_status: string;
  profile_completed: boolean;
  created_at: string;
};

export default async function AdminUsersPage() {
  const { role } = await requireAdminAccess('admin');
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, platform_role, kyc_status, profile_completed, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const users = (data ?? []) as unknown as UserRow[];
  const canEditRoles = role === 'platform_admin' || role === 'super_admin';

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Users</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="font-medium">{user.full_name ?? 'Unnamed'}</p>
              <p className="text-sm text-muted-foreground">{user.email ?? '—'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={user.platform_role} />
                <StatusBadge status={user.kyc_status} />
              </div>
            </div>
            {canEditRoles ? (
              <form action={updateUserRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select
                  name="role"
                  defaultValue={user.platform_role}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                >
                  <option value="member">member</option>
                  <option value="compliance_officer">compliance_officer</option>
                  <option value="platform_admin">platform_admin</option>
                  <option value="super_admin">super_admin</option>
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Update
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
