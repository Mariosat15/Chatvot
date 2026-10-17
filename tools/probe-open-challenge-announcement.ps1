# Probes `__tests__/challenges/open-challenge-announcement.test.ts` - the platform-wide
# announcement that tells everybody an open seat exists.
#
# Same harness shape as `probe-challenge-notifications.ps1` - see that file for the encoding
# notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT
# APPLY means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/open-challenge-announcement.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $SUITE -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $SUITE --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$SERVICE = 'lib/services/challenges/open-challenge-announcement.ts'
$ROUTE = 'app/api/challenges/route.ts'
$TEMPLATES = 'database/models/notification-template.model.ts'
$PREFERENCES = 'database/models/user-notification-preferences.model.ts'

Write-Host ''
Write-Host 'Who hears about it' -ForegroundColor Cyan

Probe -Name 'the creator is told about their own challenge' -File $SERVICE `
  -Find 'const excluded = new Set<string>([announcement.challengerId]);' `
  -Replace 'const excluded = new Set<string>();' `
  -ExpectRed 'does not tell the creator'

Probe -Name 'a block is only read in one direction' -File $SERVICE `
  -Find '{ blockedUserId: announcement.challengerId },' `
  -Replace '' `
  -ExpectRed 'respects a block in either direction'

Probe -Name 'a per-game opt-out is ignored' -File $SERVICE `
  -Find 'for (const row of optedOut) {
    excluded.add(row.userId);
  }' `
  -Replace '' `
  -ExpectRed 'respects a per-game opt-out'

Probe -Name 'the opt-out is read across every game' -File $SERVICE `
  -Find 'gameKey: announcement.gameKey,
      willingToBeChallenged: false,' `
  -Replace 'willingToBeChallenged: false,' `
  -ExpectRed 'respects a per-game opt-out'

Probe -Name 'preferences are not consulted before storing' -File $SERVICE `
  -Find 'if (!delivery.store) continue;' `
  -Replace '' `
  -ExpectRed 'skips a player who turned notifications off entirely'

Probe -Name 'quiet hours suppress the record instead of the popup' -File $SERVICE `
  -Find 'if (delivery.push) pushTo.add(userId);' `
  -Replace 'pushTo.add(userId);' `
  -ExpectRed 'withholds the popup during quiet hours'

Probe -Name 'nobody is pushed to at all' -File $SERVICE `
  -Find 'deliverPush({ ...row.toObject(), _id: row._id });' `
  -Replace '' `
  -ExpectRed 'pushes to a player with no preferences document'

Probe -Name 'a missing template is not seeded' -File $SERVICE `
  -Find 'await checkAndSeedTemplates();' `
  -Replace '' `
  -ExpectRed 'seeds its own template'

Write-Host ''
Write-Host 'The create route' -ForegroundColor Cyan

Probe -Name 'a directed challenge is announced to everybody too' -File $ROUTE `
  -Find 'if (!isInSimulatorMode && isOpenChallenge) {' `
  -Replace 'if (!isInSimulatorMode) {' `
  -ExpectRed 'announces only when the challenge is open'

Write-Host ''
Write-Host 'The template' -ForegroundColor Cyan

Probe -Name 'the announcement mails the whole player base' -File $TEMPLATES `
  -Find 'and so lose the receipts they do want.
      */
      channels: { inApp: true, email: false, push: true },' `
  -Replace 'and so lose the receipts they do want.
      */
      channels: { inApp: true, email: true, push: true },' `
  -ExpectRed 'sends no email'

Write-Host ''
Write-Host 'The shared resolver' -ForegroundColor Cyan

Probe -Name 'the single-send path keeps its own copy of the rules' -File $PREFERENCES `
  -Find 'return resolveDeliveryFrom(prefs, category, templateId);' `
  -Replace 'return { store: true, push: true, email: true };' `
  -ExpectRed 'still answers the single-send path'

Write-Host ''
Write-Host 'Done.' -ForegroundColor Cyan
