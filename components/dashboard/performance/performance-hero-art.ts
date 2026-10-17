/**
 * Cover crop for Game Performance heroes. The card box stays a short strip;
 * 16:9 key art is taller, so cover would otherwise cut the wordmark at the top.
 * Same rule as GameSuggestionsCard (owner, 3 Oct 2026): pin to the top when
 * the box is the wider ratio. No game names — every new title uses this.
 */
export function heroObjectPosition(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): string {
  if (![imageWidth, imageHeight, boxWidth, boxHeight].every((n) => Number.isFinite(n) && n > 0)) {
    return "center top";
  }
  const imageRatio = imageWidth / imageHeight;
  const boxRatio = boxWidth / boxHeight;
  return boxRatio > imageRatio ? "center top" : "center center";
}
