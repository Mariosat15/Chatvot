import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth/auth";
import TraderChampionshipClient from "@/components/championship/TraderChampionshipClient";

const ChampionshipPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  return <TraderChampionshipClient />;
};

export default ChampionshipPage;
