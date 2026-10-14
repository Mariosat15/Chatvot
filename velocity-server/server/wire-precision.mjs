// CHARTVOLT PATCH (14 Oct 2026, owner: smoother on a weak connection). Precision for what a snapshot
// says about OTHER pilots. A rival's distance went out as `785.2444250615744` - fifteen digits to place
// a ship drawn a few pixels tall. Centimetres are far below anything visible.
//
// Reason: this is applied to the wire copy only. The simulation, the race result and the player's own
// `self` state are never rounded, so nothing the race decides can move.
const round = (value, scale) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * scale) / scale : value);

export const centimetres = value => round(value, 100);
// Heading is in radians; 1e-4 rad is under a hundredth of a degree.
export const radians = value => round(value, 1e4);
