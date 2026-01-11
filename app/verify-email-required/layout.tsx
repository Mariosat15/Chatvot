/**
 * Layout for verify-email-required page
 * This page is intentionally OUTSIDE the (auth) and (root) layouts
 * to avoid redirect loops - it's for users who have a session but haven't verified email
 */
export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

