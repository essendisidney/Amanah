import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_SUPPORT_PATH,
  canAccessAdminSupport,
} from './admin-support-access.ts';
import {
  ADMIN_NAV_GROUPS,
  adminGroupContainsPath,
  adminLinkActive,
} from './admin-nav-config.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('canAccessAdminSupport', () => {
  it('allows Platform Admin and other compliance roles', () => {
    assert.equal(canAccessAdminSupport('platform_admin'), true);
    assert.equal(canAccessAdminSupport('super_admin'), true);
    assert.equal(canAccessAdminSupport('compliance_officer'), true);
  });

  it('blocks members and missing roles (unauthorized stays blocked)', () => {
    assert.equal(canAccessAdminSupport('member'), false);
    assert.equal(canAccessAdminSupport(null), false);
    assert.equal(canAccessAdminSupport(undefined), false);
  });
});

describe('Admin Support navigation + direct load paths', () => {
  it('exposes Support in nav at the canonical path', () => {
    const support = ADMIN_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.label === 'Support',
    );
    assert.ok(support);
    assert.equal(support.href, ADMIN_SUPPORT_PATH);
  });

  it('marks Support active for nav click and direct load of /admin/support', () => {
    assert.equal(adminLinkActive('/admin/support', ADMIN_SUPPORT_PATH), true);
    assert.equal(adminGroupContainsPath(ADMIN_NAV_GROUPS[0]!, '/admin/support'), true);
  });

  it('does not treat sibling admin routes as Support', () => {
    assert.equal(adminLinkActive('/admin', ADMIN_SUPPORT_PATH), false);
    assert.equal(adminLinkActive('/admin/users', ADMIN_SUPPORT_PATH), false);
    assert.equal(adminLinkActive('/dashboard', ADMIN_SUPPORT_PATH), false);
  });
});

describe('Admin Support page authorization wiring (regression)', () => {
  it('gates with requireAdminAccess(compliance) and never calls getUserProfile() bare', () => {
    const pagePath = join(
      here,
      '../../../app/(app)/admin/support/page.tsx',
    );
    const source = readFileSync(pagePath, 'utf8');

    assert.match(
      source,
      /requireAdminAccess\(\s*['"]compliance['"]\s*,\s*ADMIN_SUPPORT_PATH\s*\)/,
      'Support page must use requireAdminAccess like other admin routes',
    );
    assert.match(source, /ADMIN_SUPPORT_PATH/);
    assert.doesNotMatch(
      source.replace(/\/\/[^\n]*/g, ''),
      /getUserProfile\s*\(\s*\)/,
      'Bare getUserProfile() returns null and falsely redirects Platform Admins to /dashboard',
    );
    assert.doesNotMatch(
      source,
      /redirect\(\s*['"]\/dashboard['"]\s*\)/,
      'Page must not redirect on its own; requireAdminAccess owns the deny path',
    );
    assert.match(source, /replySupportTicketAction/);
  });

  it('help lists only the signed-in member tickets and reply stays admin-gated', () => {
    const help = readFileSync(join(here, '../../../app/(app)/help/page.tsx'), 'utf8');
    const actions = readFileSync(
      join(here, '../../help/actions/support-ticket-actions.ts'),
      'utf8',
    );
    assert.match(help, /\.eq\(\s*['"]user_id['"]\s*,\s*user\.id\s*\)/);
    assert.match(actions, /export async function replySupportTicketAction/);
    assert.match(
      actions,
      /async function replySupportTicketAction[\s\S]*?requireAdminAccess\(\s*['"]compliance['"]/,
    );
  });
});
