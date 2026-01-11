import ModernDashboardCharts from "@/components/dashboard/ModernDashboardCharts";
import { getComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";

// Force dynamic rendering - this page uses authentication
export const dynamic = 'force-dynamic';

const Dashboard = async () => {
    // Get comprehensive dashboard data including competitions and challenges
    const dashboardData = await getComprehensiveDashboardData();

    return (
        <div className="min-h-screen p-4 md:p-6 lg:p-8">
          <ModernDashboardCharts data={dashboardData} />
        </div>
    )
}

export default Dashboard;
