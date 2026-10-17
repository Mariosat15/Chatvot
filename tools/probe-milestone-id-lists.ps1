# R105 probes — a comma-joined id list is not a list.
# Each probe reintroduces one defect and must turn RED on exactly one test.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-Utf8([string]$Path) {
  [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = '__tests__/admin/milestone-id-lists.test.ts'
  )

  $full = Join-Path $Root $File
  $orig = Read-Utf8 $full
  # Reason: an empty read plus a happy write empties the file and every probe
  # then goes red for the wrong reason — refuse rather than report damage.
  if ([string]::IsNullOrEmpty($orig)) { throw "PROBE DID NOT APPLY (empty read): $File" }

  $idx = $orig.IndexOf($Find)
  # Reason: report and carry on rather than throwing, so one moved anchor does
  # not silently skip every probe after it.
  if ($idx -lt 0) { Write-Host "DID NOT APPLY (Find miss): $Name"; return }
  $mut = $orig.Remove($idx, $Find.Length).Insert($idx, $Replace)
  if ($mut -eq $orig) { Write-Host "DID NOT APPLY (no change): $Name"; return }
  Write-Utf8 $full $mut

  try {
    $out = npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $failed = [regex]::Match($out, 'Tests\s+(\d+)\s+failed').Groups[1].Value
    $passed = [regex]::Match($out, 'Tests\s+.*?(\d+)\s+passed').Groups[1].Value
    if ($failed -eq '1') { Write-Host "RED x1  $Name" }
    else {
      Write-Host "FAIL    $Name  failed='$failed' passed='$passed'  expect=$ExpectTest"
      ($out -split "`n") | Where-Object { $_ -match 'FAIL|AssertionError|No test files' } |
        Select-Object -First 6 | ForEach-Object { Write-Host "  $($_.Trim())" }
    }
  } finally {
    Write-Utf8 $full $orig
  }
}

$SHARED = 'apps/admin/lib/admin/milestone-id-lists.ts'
$ROUTE  = 'apps/admin/app/api/ai/gamification-wizard/route.ts'
$UI     = 'apps/admin/components/admin/GamificationWizardSection.tsx'

# ── The reading itself ───────────────────────────────────────────────────────

# 1 — stop splitting a string, which is the format the agent was handed
Invoke-Probe -Name 'no-split' -File $SHARED `
  -Find 'typeof value === "string" ? value.split(",")' `
  -Replace 'typeof value === "string" ? [value]' `
  -ExpectTest 'splits the format the agent was given'

# 2 — drop one of the four coercible paths
Invoke-Probe -Name 'only-required-badges' -File $SHARED `
  -Find '  "gameTypes",
' -Replace '' `
  -ExpectTest 'normalises every path declared as a list of strings, and only those'

# 3 — normalise an absent list into an empty one, erasing "platform-wide"
Invoke-Probe -Name 'invents-empty-list' -File $SHARED `
  -Find 'if (!(field in milestone)) continue;' `
  -Replace 'if (false) continue;' `
  -ExpectTest 'does not invent an absent list'

# 4 — rewrite a clean list, putting a no-op change in the operator's diff
Invoke-Probe -Name 'rewrites-clean-list' -File $SHARED `
  -Find '      continue;
    }
    normalised ??=' -Replace '    }
    normalised ??=' `
  -ExpectTest 'leaves a clean list alone, by reference'

# 5 — let a non-string entry through, so a gate can hold a number
Invoke-Probe -Name 'keeps-non-strings' -File $SHARED `
  -Find 'if (typeof entry !== "string") continue;' `
  -Replace 'if (typeof entry !== "string") { seen.add(String(entry)); continue; }' `
  -ExpectTest 'yields an empty list for a shape with no reading, rather than throwing'

# ── Where the reading happens ────────────────────────────────────────────────

# 6 — restore the unchecked write: Mongoose then wraps the string silently
Invoke-Probe -Name 'writer-unnormalised' -File $ROUTE `
  -Find 'const clean = normaliseMilestoneIdLists(rest);' `
  -Replace 'const clean = rest;' `
  -ExpectTest 'normalises in the one milestone writer, before the document is looked up' `
  -Suite '__tests__/admin/milestone-id-lists.test.ts'

# 7 — normalise AFTER the lookup, a call that protects nothing while reading
#     as though it does
Invoke-Probe -Name 'writer-normalises-too-late' -File $ROUTE `
  -Find 'const clean = normaliseMilestoneIdLists(rest);
        const existing = await JourneyMilestone.findOne({ id: clean.id, mapId: clean.mapId });' `
  -Replace 'const existing = await JourneyMilestone.findOne({ id: rest.id, mapId: rest.mapId });
        const clean = normaliseMilestoneIdLists(rest);' `
  -ExpectTest 'normalises in the one milestone writer, before the document is looked up'

# 8 — restore the unchecked cast of the agent's reply, so review is handed a
#     string even though the write is now safe
Invoke-Probe -Name 'agent-reply-uncast' -File $ROUTE `
  -Find '? (parsed.milestones as MilestoneDraft[]).map((m) =>
            normaliseMilestoneIdLists(m as Record<string, unknown>) as MilestoneDraft,
          )' `
  -Replace '? (parsed.milestones as MilestoneDraft[])' `
  -ExpectTest "normalises the agent's proposal too, so review and write agree"

# 9 — leave the badge model's own `gameTypes` unread, one model along
Invoke-Probe -Name 'badge-gametypes-unread' -File $ROUTE `
  -Find 'clean.gameTypes = toIdList(clean.gameTypes);' `
  -Replace 'clean.gameTypes = clean.gameTypes;' `
  -ExpectTest 'reads the badge list the same way, one model along'

# 10 — restore the crash: a string satisfies `.length`, and `.join` throws
Invoke-Probe -Name 'ui-trusts-declared-type' -File $UI `
  -Find 'toIdList(m.requiredBadgeIds).length > 0' `
  -Replace '(m.requiredBadgeIds as string[] | undefined)?.length ?? 0 > 0' `
  -ExpectTest 'no longer trusts the declared type on the review screen'

# 11 — fix the guard and leave the render trusting the type, which still throws.
#      This is why the occurrences are COUNTED rather than merely found.
Invoke-Probe -Name 'ui-render-still-joins' -File $UI `
  -Find 'Requires: {toIdList(m.requiredBadgeIds).join(", ")}' `
  -Replace 'Requires: {(m.requiredBadgeIds as string[] ?? []).join(", ")}' `
  -ExpectTest 'no longer trusts the declared type on the review screen'

# 12 — import a model into the shared module, which a client component cannot do
Invoke-Probe -Name 'shared-reaches-a-model' -File $SHARED `
  -Find '/** The milestone paths declared' `
  -Replace 'import mongoose from "mongoose";

/** The milestone paths declared' `
  -ExpectTest 'keeps the shared reading model-free, so both sides can import it'
