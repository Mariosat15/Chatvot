import { Suspense } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { getComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const Dashboard = async () => {
  const dashboardData = await getComprehensiveDashboardData();

  return (
    <div>
      {/* Reason: DashboardLayout reads useSearchParams for ?tab= deep links. */}
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
        <DashboardLayout data={dashboardData} />
      </Suspense>
    </div>
  );
};

export default Dashboard;
