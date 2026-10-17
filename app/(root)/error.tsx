"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("❌ Unhandled page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-white">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-gray-400">
          An unexpected error occurred. You can try again or go back to the
          dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-500/10 px-5 py-2.5 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-700/50 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-700/80"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-gray-600">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
