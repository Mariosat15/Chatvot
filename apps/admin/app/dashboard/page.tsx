import { redirect } from "next/navigation";
import { verifyAdminAuth } from "@/lib/admin/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getTradingSurfaceVisibility } from "@/lib/services/games/live-contest-overview.service";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ firstLogin?: string }>;
}) {
  const auth = await verifyAdminAuth();

  if (!auth.isAuthenticated) {
    redirect("/login");
  }

  const params = await searchParams;
  const isFirstLogin = params.firstLogin === "true";

  // Reason: the sidebar is a client component, so it cannot read settings or query contests
  // itself. Resolved here and passed in — the same server/client split as the contest control
  // panel's copy module.
  const tradingSurface = await getTradingSurfaceVisibility();

  return (
    <AdminDashboard
      isFirstLogin={isFirstLogin}
      adminEmail={auth.email!}
      adminName={auth.name}
      isSuperAdmin={auth.isSuperAdmin || false}
      role={auth.role || "Employee"}
      allowedSections={auth.allowedSections || []}
      tradingSurfaceVisible={tradingSurface.visible}
    />
  );
}
