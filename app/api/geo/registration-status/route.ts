import { NextResponse } from "next/server";
import { getRequestGeo } from "@/lib/utils/request-geo";
import { getGeoRestrictionFacts } from "@/lib/services/geo/geo-restriction.service";
import { evaluateGeoAccess } from "@/lib/services/geo/geo-access-rule";

/**
 * Public, unauthenticated: the sign-up form reads this before anybody has an account.
 * It says which countries to leave out of the country list, and whether the caller's
 * own network country is refused. It returns the decision, never the caller's IP.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const facts = await getGeoRestrictionFacts();
  const hideFromList = facts.enabled && facts.blockRegistration;
  const decision = evaluateGeoAccess(facts, "register", {
    networkCountry: getRequestGeo(request.headers).country,
  });
  return NextResponse.json(
    {
      restrictedCountries: hideFromList ? facts.restrictedCountries : [],
      registrationAllowed: decision.allowed,
      message: decision.allowed ? undefined : decision.message,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
