/**
 * "Remember me" on the player sign-in screen.
 *
 * Only the email address is stored. The password is never written to storage:
 * the inputs carry `autocomplete="username"` / `"current-password"` so the
 * browser's own password manager can offer it, which is encrypted and per-profile.
 */

const REMEMBERED_EMAIL_KEY = "chartvolt.signIn.rememberedEmail";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Reason: localStorage THROWS (rather than returning null) when the browser
    // refuses storage, and a throw here would break the sign-in page entirely.
    return null;
  }
}

export function readRememberedEmail(): string | null {
  try {
    const value = storage()?.getItem(REMEMBERED_EMAIL_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** Save the email when the box is ticked, forget it when it is not. */
export function rememberSignInEmail(email: string, remember: boolean): void {
  try {
    const store = storage();
    if (!store) return;
    const trimmed = email.trim();
    if (remember && trimmed) {
      store.setItem(REMEMBERED_EMAIL_KEY, trimmed);
    } else {
      store.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch {
    // Storage full or refused: remembering is a convenience, never a reason to fail sign-in.
  }
}
