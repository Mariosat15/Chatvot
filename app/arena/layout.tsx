import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { redirectIfRestricted } from "@/lib/services/restriction-guard.service";

// Reason: Server-side gate — blocks /arena entirely when the admin toggle is off.
// This runs before any client JS loads, so the page never renders if disabled.
export default async function ArenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connectToDatabase();
  const settings = await WhiteLabel.findOne().select("arenaEnabled").lean();

  if (settings && settings.arenaEnabled === false) {
    redirect("/dashboard");
  }

  // Reason: restricted users cannot trade — bounce them to /account/review
  // instead of loading the broadcast-style trading dashboard.
  await redirectIfRestricted("trade");

  return <>{children}</>;
}
