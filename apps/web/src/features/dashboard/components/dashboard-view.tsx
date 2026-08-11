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
    <div className="space-y-8 md:space-y-10">
      <DashboardHero profile={data.profile} email={email} />

      {/* On phones: dues first. Stats sit below the fold. */}
      <div className="flex flex-col gap-8 md:gap-10">
        <div className="order-2 md:order-1">
          <DashboardStats data={data} />
        </div>

        <div className="order-1 grid gap-8 md:order-2 md:gap-10 lg:grid-cols-5">
          <div className="space-y-8 md:space-y-10 lg:col-span-3">
            <ContributionsSection contributions={data.contributions} />
            <MyCirclesSection jamiyas={data.jamiyas} />
          </div>
          <div className="space-y-8 md:space-y-10 lg:col-span-2">
            <PayoutsSection payouts={data.payouts} />
            <NotificationsSection
              notifications={data.notifications}
              unreadCount={data.unreadNotificationCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
