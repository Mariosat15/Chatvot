// CHARTVOLT PATCH (14 Oct 2026, owner: "in cockpit on desktop my ship was jumping from one place to
// another when near to finish the time"). Decides whether a server correction to the player's own
// ship is eased on screen or adopted as a jump. The physics state is always the server's either way;
// this only chooses how the difference is drawn.
//
// Reason: a server that stalls (its step clamp drops the lost time) runs its simulation behind the
// wall clock for the rest of the race, while the race still ends on the wall clock. So at time-up the
// server stops the ship several metres short of where the client had predicted it - measured 6 m after
// a 0.3 s stall and 20 m after 0.6 s - and the stall itself drops queued frames, a ~30 m correction.
// Both used to teleport: the old rule eased only racing -> racing corrections under 25 m. The cockpit
// camera is locked to the hull, so every teleport moved the whole view.

/** Largest difference still eased, per axis. Beyond these the ship really is somewhere else. */
export const SMOOTH_LIMITS=Object.freeze({distance:60,lateral:8,heading:1});

const ON_TRACK=new Set(['racing','finished']);

/**
 * True when a correction should be eased rather than snapped.
 * `before`/`after` carry `state` and `respawn` (seconds left); `delta` is drawn-minus-authoritative.
 */
export function easesCorrection(before,after,delta){
 // Reason: a respawn or a move to or from the grid, the hangar or the results is a real jump, and
 // easing across it would fly the ship through the scenery. Finishing is not: the ship stays on the
 // track, and the time-up correction above is exactly the one that must not teleport.
 if(!ON_TRACK.has(before?.state)||!ON_TRACK.has(after?.state))return false;
 if(before.respawn>0||after.respawn>0)return false;
 for(const axis of ['distance','lateral','heading']){const v=delta?.[axis];if(!Number.isFinite(v)||Math.abs(v)>=SMOOTH_LIMITS[axis])return false;}
 return true;
}
