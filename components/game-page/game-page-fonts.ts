import localFont from "next/font/local";

// Reason: these were `next/font/google`, which downloads the font at BUILD time. On the
// production server Google answered Orbitron with a legacy `/l/font?kit=...&skey=...` URL,
// whose two query parameters Turbopack refuses ("next/font/google queries have exactly one
// entry"), so the whole `npm run build` failed. The latin variable files are committed here
// instead - no network at build, and the answer cannot differ between machines.

/** Body / UI type for `/games/[slug]`. */
export const gpSans = localFont({
  src: "./fonts/exo2-latin-var.woff2",
  weight: "400 800",
  display: "swap",
});

/** Display titles on the game page hero. */
export const gpDisplay = localFont({
  src: "./fonts/orbitron-latin-var.woff2",
  weight: "600 800",
  display: "swap",
});
