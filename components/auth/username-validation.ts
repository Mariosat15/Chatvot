import type { RegisterOptions } from "react-hook-form";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from "@/lib/utils/username";

/**
 * Validation for the registration username field, shared by the desktop and mobile forms
 * so the two cannot disagree. The rules come from `lib/utils/username.ts` - the same
 * function the server runs - and availability is asked of the server, which stays the
 * authority: sign-up re-checks and the unique index decides a race.
 */

const lastAnswers = new Map<string, true | string>();

async function askAvailability(value: string): Promise<true | string> {
  const key = value.toLowerCase();
  const cached = lastAnswers.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(
      `/api/username/availability?u=${encodeURIComponent(value)}`,
    );
    const data = (await res.json()) as { available?: boolean; error?: string };
    const answer: true | string = data.available
      ? true
      : data.error || "That username is not available";
    // Reason: a rate-limit or server error is not a fact about the name, so it is not
    // remembered - the next attempt asks again.
    if (res.ok) lastAnswers.set(key, answer);
    return answer;
  } catch {
    // The server checks again on submit, so an unreachable check must not block the form.
    return true;
  }
}

export const usernameValidation: RegisterOptions = {
  required: "Username is required",
  minLength: {
    value: USERNAME_MIN_LENGTH,
    message: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
  },
  maxLength: {
    value: USERNAME_MAX_LENGTH,
    message: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
  },
  validate: async (value: unknown) => {
    const parsed = validateUsername(value);
    if (!parsed.ok) return parsed.error;
    return askAvailability(parsed.value);
  },
};
