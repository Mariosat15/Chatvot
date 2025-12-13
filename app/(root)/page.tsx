import LiveDashboardWrapper from "@/components/dashboard/LiveDashboardWrapper";
import { getUserDashboardData } from "@/lib/actions/dashboard.actions";

// Force dynamic rendering - this page uses authentication
export const dynamic = 'force-dynamic';

const Home = async () => {
    // Get user's competition dashboard data
    const dashboardData = await getUserDashboardData();

    return (
        <div className="flex min-h-screen home-wrapper">
          {/* Live Dashboard with Auto-Refresh */}
          <LiveDashboardWrapper initialData={dashboardData} />
        </div>
    )
}

export default Home;
