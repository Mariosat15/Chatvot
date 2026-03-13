import { redirect } from "next/navigation";

// Reason: Championship route has been replaced by /arena. Redirect for backward compatibility.
export default function ChampionshipPage() {
  redirect("/arena");
}
