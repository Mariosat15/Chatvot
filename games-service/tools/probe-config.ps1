# Probes for the boot-time configuration guards.
#
# Each removes one guard from src/config.ts (or src/app.ts) and asserts the test written for it
# goes red. The two halves matter equally here:
#
#   - The REFUSALS must fire. A production deployment with a localhost play origin or no frame
#     allowlist fails invisibly, and these guards are the only thing that catches it.
#   - The DEVELOPMENT CARVE-OUT must hold. A guard that fired locally would break the smoke
#     tools and the whole test suite, and would be reverted within the day. So there are probes
#     that widen the guards to fire everywhere, and the development tests must catch that.
#
# Run: npm run probe:config

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)

. "$PSScriptRoot/probe-harness.ps1"

$SuiteConfig = "tools/test-config.ts"
$srcConfig = "src/config.ts"
$srcApp = "src/app.ts"

Write-Host ""
Write-Host "Probing the configuration guards" -ForegroundColor Cyan
Write-Host ""

$results = @()

# ── the refusals must fire ────────────────────────────────────────────────────────────────────

$results += Invoke-Probe -Name "the play origin goes back to being optional everywhere" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'if (isProduction()) assertPlayableOrigin(value);' `
  -Replace '' `
  -ExpectRed "production refuses a loopback play origin" `
  -MaxRed 4  # loopback, plain http, and not-a-URL all rely on this one line

$results += Invoke-Probe -Name "the https requirement is dropped" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'if (parsed.protocol !== "https:") {' `
  -Replace 'if (false) {' `
  -ExpectRed "production refuses a plain-http play origin"

$results += Invoke-Probe -Name "the loopback check misses 127.0.0.1" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'host === "localhost" || host === "127.0.0.1"' `
  -Replace 'host === "localhost"' `
  -ExpectRed "production refuses a loopback play origin"

$results += Invoke-Probe -Name "the loopback check misses the IPv6 form" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'host === "::1" || host === "[::1]"' `
  -Replace 'host === "never-matches"' `
  -ExpectRed "production refuses a loopback play origin"

$results += Invoke-Probe -Name "a malformed play origin is accepted instead of refused" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find '  } catch {
    throw new Error(
      `ChartVolt Games cannot start: GAMES_PUBLIC_URL is not a valid URL (${value}).`,
    );
  }' `
  -Replace '  } catch {
    return;
  }' `
  -ExpectRed "production refuses a play origin that is not a URL at all" `
  -MaxRed 3

$results += Invoke-Probe -Name "production stops requiring the two variables at all" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'if (isProduction()) {
    throw new Error(`ChartVolt Games cannot start: ${name} is not set. ${guidance}`);
  }' `
  -Replace '' `
  -ExpectRed "production refuses to boot with no frame allowlist" `
  -MaxRed 4  # both "no play origin" and "no allowlist" refusals come through here

$results += Invoke-Probe -Name "a blank frame allowlist counts as set" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'if (value && value.trim().length > 0) return value.trim();

  if (isProduction()) {' `
  -Replace 'if (value !== undefined) return value.trim();

  if (isProduction()) {' `
  -ExpectRed "a blank frame allowlist is refused in production, not treated as set" `
  -MaxRed 4

# ── the development carve-out must hold ───────────────────────────────────────────────────────
#
# Reason these are probed at all: a guard that is right about production and wrong about
# development is worse than no guard, because it gets reverted rather than fixed.

$results += Invoke-Probe -Name "the guards are widened to fire in development too" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'return process.env.NODE_ENV === "production";' `
  -Replace 'return true;' `
  -ExpectRed "development boots with neither the play origin nor the allowlist set" `
  -MaxRed 4

$results += Invoke-Probe -Name "the development fallback hard-codes the port" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find '`http://localhost:${integer("PORT", 4010)}`' `
  -Replace '"http://localhost:4010"' `
  -ExpectRed "the development play origin follows PORT rather than hard-coding 4010"

$results += Invoke-Probe -Name "the trailing-slash strip is removed" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find '.replace(/\/+$/, "");

  if (isProduction()) assertPlayableOrigin(value);' `
  -Replace ';

  if (isProduction()) assertPlayableOrigin(value);' `
  -ExpectRed "a trailing slash on the play origin is stripped, in production too"

# ── the carve-out must not have leaked onto the secrets ──────────────────────────────────────

$results += Invoke-Probe -Name "a required secret becomes production-only" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'apiSecret: required("GAMES_API_SECRET"),' `
  -Replace 'apiSecret: requiredInProduction("GAMES_API_SECRET", "dev", "x"),' `
  -ExpectRed "a missing secret is still refused in development"

$results += Invoke-Probe -Name "sandbox mode turns itself on under production" `
  -Suite $SuiteConfig -File $srcConfig `
  -Find 'sandbox: optional("GAMES_SANDBOX", "false") === "true",' `
  -Replace 'sandbox: optional("GAMES_SANDBOX", isProduction() ? "true" : "false") === "true",' `
  -ExpectRed "sandbox mode still defaults off under a production environment"

Write-ProbeSummary $results
