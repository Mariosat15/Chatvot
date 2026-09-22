import { Exo_2, Orbitron } from "next/font/google";

/** Body / UI type for `/games/[slug]`. */
export const gpSans = Exo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/** Display titles on the game page hero. */
export const gpDisplay = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});
