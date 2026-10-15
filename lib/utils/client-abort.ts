/**
 * True when the client hung up before the server finished reading the request
 * (tab closed, navigated away). Node surfaces this as `Error: aborted` from
 * `request.json()`; it is not a server fault and should not be logged as one.
 */
export function isClientAbort(error: unknown, request?: Request): boolean {
  if (request?.signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return (
    error.message === "aborted" ||
    error.name === "AbortError" ||
    code === "ECONNRESET" ||
    code === "ERR_STREAM_PREMATURE_CLOSE"
  );
}
