# Probes for __tests__/admin/image-optimizer-route-guard.test.ts
#
# THE DEFECT THIS GUARDS. Until 8 September 2026 both exported handlers on
# apps/admin/app/api/dev-zone/optimize-images/route.ts had NO authorization of any kind. The
# screen was gated behind the `image-optimizer` grant, so it reviewed as protected while the
# route behind it answered anybody who could address the admin app - and the POST handler
# re-encodes files in place and `unlink`s the original across `public/uploads` and
# `public/assets/avatars`, so an image whose only copy was on that disk is gone.
#
# Ninth route of this class, after Prerequisite A, the internal-secret fallbacks, the
# suspicion-score route, the provider admin routes, R40's `finalize-old-competitions`, R47's
# `sync-referrals`, R51's five AI routes, and the two `verifyAdminToken` cases. Found the same
# way as R40 and R47: counting exported handlers against guards, never by reading routes -
# every neighbour having *something* is exactly what sends a reader past the one that has
# nothing.
#
# Harness rules are the ones every earlier probe file here learned the hard way: read and write
# through [System.IO.File] with UTF-8 and no BOM, refuse to write when the read came back empty,
# confirm the replacement actually changed the file, and run the expected test ALONE with `-t`
# reading the summary counts - searching whole-suite output for a name finds it either way.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/admin/image-optimizer-route-guard.test.ts'
$Route = 'apps/admin/app/api/dev-zone/optimize-images/route.ts'

function Read-File([string]$Rel) {
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest,
    [int]$MaxRed = 3
  )

  $original = Read-File $File
  $mutated = [regex]::Replace($original, (Relaxed $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  try {
    Write-File $File $mutated

    $out = & npx vitest run $Suite -t "$ExpectTest" 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -ge 1 -and $failed -le $MaxRed) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } elseif ($failed -gt $MaxRed) {
      # A one-line change turning many tests red usually means the harness damaged the file
      # rather than that the guard is broad. The honest number here is 1 or 2.
      Write-Host "[$Name] RED BUT TOO BROAD ($failed failed, expected <= $MaxRed) - check the file survived" -ForegroundColor Yellow
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, or probe aimed wrong." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

Write-Host "`n=== Probing the image-optimizer route guard ===`n" -ForegroundColor Cyan

# 1 - the original defect, verbatim: no authorization at all on either handler.
Invoke-Probe -Name '1 both guards removed (the shipped defect)' -File $Route `
  -From @'
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

  try {
    const directories = await findAllImageDirectories();
'@ -To @'
  try {
    const directories = await findAllImageDirectories();
'@ -ExpectTest 'authenticates every exported handler'

# 2 - the half-fix, which is the shape that reviews as done. Guard the GET, leave the
#     destructive POST open. A per-file check is green on this.
Invoke-Probe -Name '2 only the GET guarded, POST left open' -File $Route `
  -From @'
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
'@ -To @'
  try {
    const body = await request.json();
'@ -ExpectTest 'authenticates every exported handler'

# 3 - guard present but AFTER the body is parsed. Still refuses, but work has been done for an
#     unauthenticated caller.
Invoke-Probe -Name '3 POST guard moved below request.json()' -File $Route `
  -From @'
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { mode = "all", images: selectedImages = [] } = body;
'@ -To @'
  try {
    const body = await request.json();
    const { mode = "all", images: selectedImages = [] } = body;
    const guard = await guardSection("image-optimizer");
    if (!guard.ok) return guard.response;
'@ -ExpectTest 'guards the POST before reading the body'

# 4 - the weaker helper. `verifyAdminAuth` satisfies the folder-wide assertion, so only the
#     strong per-route test can catch it - and it is the substantive defect, since an employee
#     granted one unrelated section would pass it and could delete the upload tree.
Invoke-Probe -Name '4 downgraded to verifyAdminAuth' -File $Route `
  -From 'const guard = await guardSection("image-optimizer");' `
  -To 'const guard = await verifyAdminAuth();' `
  -ExpectTest 'guards both handlers with the strong helper'

# 5 - an adjacent, real section id. The compiler accepts it because it is a valid AdminSection,
#     so nothing but this assertion notices the wrong grant being demanded.
Invoke-Probe -Name '5 guarded by the wrong real section' -File $Route `
  -From 'const guard = await guardSection("image-optimizer");' `
  -To 'const guard = await guardSection("database");' `
  -ExpectTest 'uses the section that reveals the screen'

# 6 - the guard called but its refusal discarded. Reads perfectly and authorizes nothing.
#
#     THIS PROBE CAME BACK GREEN FIRST TIME and the test was the weak one, not the claim. The
#     assertion was a whole-file `toMatch`, satisfied by the GET's surviving refusal while the
#     POST's was gone - the same identifier appearing twice defeating a structural test. Fixed
#     by counting refusals against guard calls, which is the actual property.
Invoke-Probe -Name '6 refusal never returned' -File $Route `
  -From @'
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
'@ -To @'
  const guard = await guardSection("image-optimizer");

  try {
    const body = await request.json();
'@ -ExpectTest 'own refusal, once per guard'

Write-Host "`n=== Probing the folder-wide tripwire ===`n" -ForegroundColor Cyan

# 7 - a NEW route added to dev-zone with no authorization. This is what the weak folder-wide
#     assertion exists for, and what a per-file allow-list would let through silently.
$NewRoute = 'apps/admin/app/api/dev-zone/probe-temp/route.ts'
$NewDir = Join-Path $Root 'apps/admin/app/api/dev-zone/probe-temp'
try {
  New-Item -ItemType Directory -Path $NewDir -Force | Out-Null
  Write-File $NewRoute @'
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: true });
}
'@

  $out = & npx vitest run $Suite -t 'authenticates every exported handler' 2>&1 | Out-String
  $flat = ($out -replace '\s+', ' ')
  $failed = 0
  if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

  if ($failed -ge 1) {
    Write-Host "[7 unguarded route added to the folder] RED ($failed failed)" -ForegroundColor Green
  } else {
    Write-Host "[7 unguarded route added to the folder] GREEN - the directory walk is not catching a new route." -ForegroundColor Red
    Write-Host $flat
  }
} finally {
  Remove-Item -LiteralPath $NewDir -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $NewDir) { Write-Host '[7] CLEANUP FAILED - remove apps/admin/app/api/dev-zone/probe-temp by hand' -ForegroundColor Red }
}

Write-Host "`n=== Probing the comment stripper ===`n" -ForegroundColor Cyan

# 8 - the route's own comments name `guardSection` in prose. A test that reads prose passes a
#     file whose ONLY mention of the guard is the paragraph describing it. Comment the calls
#     out and the strong assertion must still go red.
Invoke-Probe -Name '8 guard calls commented out, prose left behind' -File $Route `
  -From 'const guard = await guardSection("image-optimizer");' `
  -To '// const guard = await guardSection("image-optimizer");' `
  -ExpectTest 'guards both handlers with the strong helper'

Write-Host "`nDone. Every probe should read RED. A GREEN line means that guard is not holding.`n" -ForegroundColor Cyan
