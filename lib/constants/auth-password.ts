/** Shared password rules for desktop + mobile registration. */
export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p: string) => p.length >= 8,
  },
  {
    id: "uppercase",
    label: "At least 1 uppercase letter (A-Z)",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "lowercase",
    label: "At least 1 lowercase letter (a-z)",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "At least 1 number (0-9)",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "At least 1 special character (!@#$%^&*)",
    test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
  },
] as const;

export function passwordMeetsRequirements(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
}
