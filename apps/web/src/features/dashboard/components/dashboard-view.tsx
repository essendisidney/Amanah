import type { DashboardData } from '../types';
import { ContributionsSection } from './contributions-section';
import { DashboardHero } from './dashboard-hero';
import { DashboardStats } from './dashboard-stats';
import { MyCirclesSection } from './my-circles-section';
import { NotificationsSection } from './notifications-section';
import { PayoutsSection } from './payouts-section';

export function DashboardView({
  data,
  email,
}: {
  data: DashboardData;
  email?: string | null;
}) {
  return (
    <div className="space-y-10">
      <DashboardHero profile={data.profile} email={email} />
      <DashboardStats data={data} />

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="space-y-10 lg:col-span-3">
          <MyCirclesSection jamiyas={data.jamiyas} />
          <ContributionsSection contributions={data.contributions} />
        </div>
        <div className="space-y-10 lg:col-span-2">
          <PayoutsSection payouts={data.payouts} />
          <NotificationsSection
            notifications={data.notifications}
            unreadCount={data.unreadNotificationCount}
          />
        </div>
      </div>
    </div>
  );
}
