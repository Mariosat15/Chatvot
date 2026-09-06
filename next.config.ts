import type { NextConfig } from "next";

/**
 * Where the ChartVolt Games provider service listens, on the loopback interface.
 *
 * Overridable so the service can be moved to another port or another machine without a code
 * change, but the default is the ordinary case: same server, port 4010.
 */
const GAMES_UPSTREAM = process.env.GAMES_INTERNAL_URL ?? "http://127.0.0.1:4010";

/**
 * Serve the first-party game provider's play surface through this app.
 *
 * WHY A REWRITE RATHER THAN A SUBDOMAIN
 * -------------------------------------
 * The game runs as a genuinely separate service on its own port, exactly as a third-party
 * provider would - that separation is the point of the phase and none of it changes here. The
 * only question this answers is how the PLAYER'S BROWSER reaches it, and the two options are a
 * `games.` subdomain (its own DNS record, its own nginx server block, its own certificate) or a
 * proxy through the app that already has all three.
 *
 * The proxy wins on deployment risk, which is the deciding factor on a server already serving
 * live traffic: it needs no DNS record, no nginx edit and no certificate, so putting the game
 * live becomes the same `git pull` and rebuild as any other change. Nothing that can take the
 * existing sites down is involved.
 *
 * WHAT IT COSTS, STATED PLAINLY
 * -----------------------------
 * The game frame becomes SAME-ORIGIN with the platform. Everything about the provider protocol
 * is still exercised for real - signed outbound calls, the round lifecycle, the signed inbound
 * callback, score ingestion and settlement - because none of that involves the browser. What is
 * no longer rehearsed is the cross-origin part: the play screen's `event.origin` check passes
 * trivially instead of being tested against a different origin, and the service's
 * `frame-ancestors` policy is not what permits the embed.
 *
 * That gap is real and is recorded in `21` s4.1c. It closes at X4 against a real provider, which
 * is cross-origin by construction and needs no work here - **an external provider requires
 * neither a rewrite nor an nginx change**, because they host their own play surface on their own
 * domain and we only store its address.
 *
 * WHY THE PATHS ARE WHAT THEY ARE
 * -------------------------------
 * `/play` is used because the service's own HTML references `/play/app.css` and `/play/app.js`
 * ABSOLUTELY. Mounting it anywhere else would leave the page loading and its stylesheet and
 * script 404ing - a blank white frame with no server-side error, which is the failure mode this
 * whole area keeps producing.
 *
 * Artwork is mounted under `/play/assets/` rather than `/assets/`, because **this app already has
 * a `public/assets` directory** and claiming that prefix would shadow it for any missing file
 * and be shadowed by it for any present one. `GAMES_ASSET_BASE_URL` on the service is set to
 * `<origin>/play` to match, so the catalogue emits URLs that resolve here.
 *
 * The artwork rule must stay FIRST. Rewrites match in order, and `/play/:path*` would otherwise
 * swallow `/play/assets/...` and forward it to a path the service does not serve.
 */
async function rewrites() {
  return [
    // Catalogue artwork: /play/assets/<gameCode>/<file> -> <service>/assets/<gameCode>/<file>
    {
      source: "/play/assets/:gameCode/:asset",
      destination: `${GAMES_UPSTREAM}/assets/:gameCode/:asset`,
    },
    // The play page itself, which the launch URL points at.
    { source: "/play", destination: `${GAMES_UPSTREAM}/play` },
    // Its stylesheet, its two scripts, and the four /play/api/* calls the board makes.
    { source: "/play/:path*", destination: `${GAMES_UPSTREAM}/play/:path*` },
  ];
}

const nextConfig: NextConfig = {
  // Returned as a plain array, which Next.js treats as `afterFiles`: real pages and files in
  // `public/` are matched first and always win. Reason this matters for safety - it means these
  // three rules can only ever catch paths this app does not already serve, so adding them cannot
  // change the behaviour of any existing route.
  rewrites,
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["inngest"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
