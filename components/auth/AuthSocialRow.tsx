"use client";

import { toast } from "sonner";

/** Visual-only social row from the owner mockup. Not wired to Better Auth. */
export default function AuthSocialRow() {
  const notYet = (name: string) => {
    toast.info(`${name} sign-in is not enabled yet.`);
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-cyan-400/25" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
          Or continue with
        </span>
        <span className="h-px flex-1 bg-cyan-400/25" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => notYet("Google")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/16"
        >
          <GoogleMark />
          Google
        </button>
        <button
          type="button"
          onClick={() => notYet("Apple")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/16"
        >
          <AppleMark />
          Apple
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.6 0 4.8-.9 6.4-2.3l-3.1-2.4c-.9.6-2 1-3.3 1-2.5 0-4.6-1.7-5.4-4H3.3v2.5C4.9 19.8 8.2 22 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.6 14.3c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V8.2H3.3C2.5 9.7 2 11.3 2 13s.5 3.3 1.3 4.8l3.3-3.5z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.7c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.8 14.6 2 12 2 8.2 2 4.9 4.2 3.3 7.5l3.3 2.5C7.4 7.4 9.5 5.7 12 5.7z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden>
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.3c1.1-1.5 1.5-2.9 1.5-3 .1 0-2.9-1.1-2.8-3.4zM14.4 6.2c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.4z" />
    </svg>
  );
}
