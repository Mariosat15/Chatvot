/**
 * Inline module error with Retry (Complobyymobile §19).
 */

export function MobileLobbyError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
      <p className="break-words">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-xl border border-rose-400/40 px-4 font-semibold text-rose-100"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
