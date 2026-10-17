/**
 * Resolve which picture to show in messaging UI.
 *
 * Reason: messages store a snapshot `senderAvatar`, while the conversation list
 * stores a participant `avatar`. Either may be missing (older rows, or sends
 * that only saw Better Auth's `image` while the upload lived in `profileImage`).
 * Prefer the message snapshot, then the live participant, then nothing — the
 * UI falls back to a letter initial when this returns undefined.
 */
export function resolveChatAvatar(options: {
  senderAvatar?: string | null;
  participantAvatar?: string | null;
}): string | undefined {
  const fromMessage = options.senderAvatar?.trim();
  if (fromMessage) return fromMessage;
  const fromParticipant = options.participantAvatar?.trim();
  if (fromParticipant) return fromParticipant;
  return undefined;
}
