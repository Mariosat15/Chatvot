# Probes the client-bundle driver guard by reintroducing the two real defects it exists for.
#
# Probe 1 - the outage, 9 September 2026. GameScoringDialog.tsx (a "use client" file)
# value-imports SCORE_UNIT_MAX_LENGTH from game-scoring-rules.service.ts, whose second link is
# `import { MongoClient } from "mongodb"`. That fails `next build` with unresolvable Node
# builtins and leaves the admin app with no .next directory. It does NOT fail the typecheck.
#
# Probe 2 - the same defect latent in the MAIN app, found by extending the guard to it.
# MarketStatusBanner.tsx names `real-forex-prices.service` in a value-import position; that
# module reaches the driver three links on. It builds today only because both bindings are
# interfaces the bundler elides, so `import type` is what makes the erasure a decision rather
# than an accident. Probing it proves the guard covers the app with the player traffic.
#
# Harness rules encoded here, each of which has produced a false result in this repository:
#   - -LiteralPath / ReadAllText on the READ as well as the WRITE. A Next.js dynamic segment
#     such as [roundId] is parsed by PowerShell as a wildcard character class, so a plain
#     Get-Content returns $null and the file is "restored" to nothing while every probe
#     reports red.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 WITHOUT a BOM on both, and assert a lossless round trip. PowerShell 5.1 decodes
#     with the system ANSI codepage, so emoji come back as mojibake and are written back that
#     way - probes pass, files are quietly mangled, and it surfaces two steps later.
#   - Name the EXPECTED failing test and run it alone with -t. Searching whole-suite output for
#     a test's name reports red for a passing test as readily as a failing one.
#   - Assert the file actually changed. A probe that fails to apply is indistinguishable from a
#     test that does not work, and DID NOT APPLY means the target moved - never that the run
#     was quiet.

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$expected = "no client component reaches ``mongodb``, directly or through any chain"
$suite = "__tests__/admin/client-bundle-model-imports.test.ts"

# Reason: the assertion lives in a describe.each-style loop over both apps, so -t selects the
# test in BOTH. One failure out of the two matched tests is the honest number for either probe.
$probes = @(
    @{
        Name = "admin: client component value-imports a driver-reaching service"
        File = Join-Path $repo "apps\admin\components\admin\games\GameScoringDialog.tsx"
        Find = @'
  SCORE_UNIT_MAX_LENGTH,
} from "@/lib/admin/score-eligibility-copy";
'@
        Replace = @'
} from "@/lib/admin/score-eligibility-copy";
import { SCORE_UNIT_MAX_LENGTH } from "@/lib/services/game-providers/game-scoring-rules.service";
'@
    },
    @{
        Name = "main: client component names a driver-reaching module in a value import"
        File = Join-Path $repo "components\trading\MarketStatusBanner.tsx"
        Find = @'
import type {
  MarketStatus,
'@
        Replace = @'
import {
  MarketStatus,
'@
    }
)

function Read-Source([string]$path) {
    $text = [System.IO.File]::ReadAllText($path, $utf8)
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-Host "ABORT: read returned empty for $path" -ForegroundColor Red
        exit 1
    }
    return $text
}

function Write-Source([string]$path, [string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-Host "ABORT: refusing to write empty content to $path" -ForegroundColor Red
        exit 1
    }
    [System.IO.File]::WriteAllText($path, $text, $utf8)
}

# Reason: escape the pattern, then relax every newline to \r?\n. A multi-line literal with
# CRLF endings does not match an LF file, and the probe then reports DID NOT APPLY on a
# perfectly good target.
function Relaxed([string]$literal) {
    return [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

$results = @()

foreach ($probe in $probes) {
    Write-Host ""
    Write-Host "=== $($probe.Name) ===" -ForegroundColor Cyan

    $path = $probe.File
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "ABORT: $path does not exist. Re-aim the probe." -ForegroundColor Red
        exit 1
    }

    $original = Read-Source $path

    # Lossless round trip, before anything is mutated.
    Write-Source $path $original
    if ((Read-Source $path) -ne $original) {
        Write-Host "ABORT: read/write is not lossless. Fix the encoding before trusting any probe." -ForegroundColor Red
        exit 1
    }

    $mutated = $original -replace (Relaxed $probe.Find), $probe.Replace
    if ($mutated -eq $original) {
        Write-Host "PROBE DID NOT APPLY - the target moved. This is NOT a quiet pass; re-aim it." -ForegroundColor Red
        $results += "DID NOT APPLY: $($probe.Name)"
        continue
    }

    Write-Host "Injecting the defect ..." -ForegroundColor Yellow
    Write-Source $path $mutated

    try {
        $raw = & npx vitest run $suite -t $expected 2>&1 | Out-String
        # Reason: Out-String wraps at the console width, so a long test name arrives split
        # across two lines and a literal match silently misses it. Collapse whitespace first.
        $flat = ($raw -replace '\s+', ' ')

        if ($flat -match 'Tests\s+(\d+)\s+failed') {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "RED (1 failure, as expected) - the guard catches the defect." -ForegroundColor Green
                $results += "RED (1): $($probe.Name)"
            } else {
                Write-Host "RED but $failed failures for a one-line change. Expected 1." -ForegroundColor Yellow
                Write-Host "  More damage than the probe caused means it is not reporting on this guard." -ForegroundColor Yellow
                $results += "RED ($failed): $($probe.Name)"
            }
        } else {
            Write-Host "GREEN - THE GUARD DOES NOT CATCH THE DEFECT." -ForegroundColor Red
            Write-Host "  Four causes, and they need different answers: a weak test, a wrong claim," -ForegroundColor Red
            Write-Host "  an unreachable guard, or a mutation that changed no observable." -ForegroundColor Red
            Write-Host ($raw -split "`n" | Select-Object -Last 12)
            $results += "GREEN: $($probe.Name)"
        }
    } finally {
        Write-Source $path $original
        if ((Read-Source $path) -eq $original) {
            Write-Host "Restored $(Split-Path -Leaf $path)." -ForegroundColor Cyan
        } else {
            Write-Host "RESTORE FAILED - check git status before committing." -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host "  $_" }
