import Link from "next/link";
import { CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SIGN_IN_PATH } from "@/lib/auth/sign-out-and-leave";

export const metadata = { title: "Email verified" };

/**
 * Landing page for a successful verification link.
 *
 * Reason: it lives outside the (auth) and (root) groups on purpose. Both layouts
 * redirect on session state, and the verification link must always end on a
 * plain "verified, now sign in" screen whatever cookies the browser holds.
 */
export default function EmailVerifiedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900/80 border-gray-800 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Email verified
          </CardTitle>
          <CardDescription className="text-gray-400">
            Your account is active. Sign in with your email and password to
            continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`${SIGN_IN_PATH}?verification=success`}
            className="flex w-full items-center justify-center rounded-md bg-yellow-500 px-4 py-2.5 font-semibold text-black hover:bg-yellow-600"
          >
            Continue to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
