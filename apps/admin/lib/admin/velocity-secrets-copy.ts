/**
 * Shared by the Volt Velocity secrets control (a client component) and its service (which uses
 * `node:fs` and so must never reach the browser bundle - R58). One definition, so the phrase the
 * screen asks for is always the phrase the server accepts.
 */

/** Typed by the operator to replace secrets that are already set. */
export const VELOCITY_ROTATE_CONFIRMATION = "ROTATE";

/** Both processes read the secrets only at boot. */
export const VELOCITY_RESTART_COMMAND = "pm2 restart chartvolt-games chartvolt-velocity";
