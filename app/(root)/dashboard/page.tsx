import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { getComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const Dashboard = async () => {
  // Get comprehensive dashboard data including competitions and challenges
  const dashboardData = await getComprehensiveDashboardData();

  return (
    <div>
      <DashboardLayout data={dashboardData} />
    </div>
  );
};

export default Dashboard;
