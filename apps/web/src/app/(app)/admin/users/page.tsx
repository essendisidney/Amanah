import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/features/admin/lib/require-admin';
import { updateUserRoleAction } from '@/features/admin/actions/admin-actions';
import { AdminSectionHeader } from '@/features/admin/components/admin-section-header';
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
    <div className="space-y-5">
      <AdminSectionHeader
        title="Users"
        subtitle={`${users.length} recent profiles. Role edits need platform admin.`}
      />
      {users.length === 0 ? (
        <p className="amanah-surface px-4 py-5 text-sm text-muted-foreground sm:px-5">
          No users yet.
        </p>
      ) : (
        <ul className="amanah-surface divide-y divide-border/70">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">{user.full_name ?? 'Unnamed'}</p>
                <p className="text-sm text-muted-foreground">{user.email ?? '—'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={user.platform_role} />
                  <StatusBadge status={user.kyc_status} />
                </div>
              </div>
              {canEditRoles ? (
                <form action={updateUserRoleAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <select
                    name="role"
                    defaultValue={user.platform_role}
                    className="min-h-11 rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option value="member">member</option>
                    <option value="compliance_officer">compliance_officer</option>
                    <option value="platform_admin">platform_admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <Button type="submit" variant="outline" className="min-h-11">
                    Update
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
