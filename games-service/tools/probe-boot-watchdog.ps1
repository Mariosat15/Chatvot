# Probes for the play surface's boot watchdog (8 September 2026).
#
# The watchdog is the last line of defence for the failure that reached a player twice: a module
# that 404s takes the whole graph down, so nothing runs, nothing is logged, and the platform's
# opaque overlay sits in front of a page that could have explained itself. Every probe here
# reintroduces one way for that to be silent again.
#
# HARNESS RULES, all of which have produced a false result in this repository:
#   - UTF-8 WITHOUT a BOM on the read *and* the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage, so emoji come back as mojibake and get written back that way.
#   - `-LiteralPath` on the read as well as the write, and refuse to write an empty read.
#   - Confirm the file actually changed. A pattern that fails to apply is indistinguishable from a
#     test that does not work.
#   - Name the test each probe expects to fail, and check the count. A suite going red proves
#     nothing if it went red somewhere else.
#   - Expect a blast radius of one. More than two means the probe broke something structural.

$ErrorActionPreference = 'Continue'
$Enc = New-Object System.Text.UTF8Encoding($false)
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

$Files = @{
  html = Join-Path $Root "public\play\index.html"
  app  = Join-Path $Root "public\play\app.js"
  page = Join-Path $Root "src\http\play-page.ts"
}

$Original = @{}
foreach ($key in $Files.Keys) {
  $text = [System.IO.File]::ReadAllText($Files[$key], $Enc)
  if ([string]::IsNullOrWhiteSpace($text)) {
    Write-Host "ABORT: could not read $($Files[$key])"
    exit 1
  }
  $Original[$key] = $text
}
Write-Host "Read index.html ($($Original.html.Length)), app.js ($($Original.app.Length)), play-page.ts ($($Original.page.Length))"
Write-Host ""

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$Key,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectedTest
  )

  $file = $Files[$Key]
  $mutated = $Original[$Key].Replace($Find, $Replace)
  if ($mutated -eq $Original[$Key]) {
    Write-Host "  $Name : PROBE DID NOT APPLY - pattern did not match, outcome means nothing"
    return
  }

  [System.IO.File]::WriteAllText($file, $mutated, $Enc)
  if ([System.IO.File]::ReadAllText($file, $Enc) -eq $Original[$Key]) {
    Write-Host "  $Name : WRITE DID NOT LAND"
    return
  }

  Push-Location $Root
  $out = (& npm run test:play 2>&1 | Out-String) -replace '\s+', ' '
  Pop-Location

  [System.IO.File]::WriteAllText($file, $Original[$Key], $Enc)
  if ([System.IO.File]::ReadAllText($file, $Enc) -ne $Original[$Key]) {
    Write-Host "  $Name : RESTORE FAILED - fix the file before continuing"
    exit 1
  }

  if ($out -match 'Play and delivery tests: (\d+) passed, (\d+) failed') {
    $failed = [int]$Matches[2]
    if ($failed -eq 0) {
      Write-Host "  $Name : GREEN - the guard is missing or the test cannot see this"
    }
    elseif ($failed -le 2) {
      Write-Host "  $Name : RED ($failed failed) - expected `"$ExpectedTest`""
    }
    else {
      Write-Host "  $Name : RED but $failed failed - blast radius too wide"
    }
  }
  else {
    Write-Host "  $Name : NO RESULT LINE - the suite did not run to completion"
  }
}

Write-Host "Probing the boot watchdog"
Write-Host ""

# 1. The flag goes away, so the watchdog can never tell a missing module from a slow round.
Invoke-Probe "1 no boot flag in app.js" "app" `
  "window.__circuitLoaded = true;" `
  "// window.__circuitLoaded = true;" `
  "app.js records that it loaded before it does anything else"

# 2. The flag moves inside a function, which is the plausible mistake rather than deleting it:
#    it then means "boot got that far" and reports a slow round as a missing file.
Invoke-Probe "2 the flag is set inside boot, not at module scope" "app" `
  "window.__circuitLoaded = true;" `
  "function markLoaded() {`n  window.__circuitLoaded = true;`n}" `
  "app.js records that it loaded before it does anything else"

# 3. The watchdog renders its panel and never tells the platform, so it is painted underneath an
#    opaque overlay - the exact defect the panel exists to fix, one layer down.
Invoke-Probe "3 the overlay is never released" "html" `
  'window.parent.postMessage({ type: "ready" }, "*");' `
  '/* removed */' `
  "a module that never arrives names itself instead of spinning for ever"

# 4. The error listener loses its capture flag, so a 404 is never seen and the player gets a
#    shrug instead of a filename. Correct-looking code; this is the subtle one.
Invoke-Probe "4 the error listener is not in the capture phase" "html" `
  "          true,`r`n        );" `
  "        );" `
  "a module that never arrives names itself instead of spinning for ever"

# 5. The deadline moves past the platform's 12s timeout, so the platform speaks first and this is
#    dead code that still reads correctly.
Invoke-Probe "5 the watchdog waits longer than the platform" "html" `
  "var BOOT_DEADLINE_MS = 8000;" `
  "var BOOT_DEADLINE_MS = 15000;" `
  "a module that never arrives names itself instead of spinning for ever"

# 6. The watchdog is moved below the module graph it watches.
Invoke-Probe "6 the watchdog sits below the module" "html" `
  '    <script type="module" src="/play/app.js"></script>' `
  '' `
  "a module that never arrives names itself instead of spinning for ever"

# 8. The timeline is consulted but not filtered by status, so the message names whichever file
#    happened to load last. This is the defect that was found by LOOKING at the panel rather than
#    by reading the code: naming a file that loaded correctly is worse than naming nothing.
Invoke-Probe "8 the named file is not the one that failed" "html" `
  "entries[i].responseStatus >= 400" `
  "entries[i].responseStatus >= 0" `
  "a module that never arrives names itself instead of spinning for ever"

# 9. The re-fetch uses the cache mode that reads round the cache without REPLACING it, so the
#    page reloads straight back into the same stale refusal. The plausible wrong choice.
Invoke-Probe "9 the re-fetch does not replace the cached entry" "html" `
  'cache: "reload"' `
  'cache: "no-store"' `
  "a stale refusal in the browser's own cache is cured, not merely reported"

# 10. The single-attempt guard goes away, so the recovery reloads for ever on a file that really
#     is missing - a round flickering in front of the player, worse than the panel.
Invoke-Probe "10 the retry is not limited to one attempt" "html" `
  "if (window.sessionStorage.getItem(`"circuit-cache-retry`")) return false;" `
  "" `
  "a stale refusal in the browser's own cache is cured, not merely reported"

# 11. Storage refused now FAILS OPEN, which is the same loop by a different route: the browser
#     that cannot record the attempt is exactly the one that cannot detect the loop.
Invoke-Probe "11 a browser without storage may retry for ever" "html" `
  "          } catch (ignored) {`r`n            return false;`r`n          }" `
  "          } catch (ignored) {`r`n            return true;`r`n          }" `
  "a stale refusal in the browser's own cache is cured, not merely reported"

# 12. The recovery fires on any stalled boot rather than on a recorded failure, so a slow round
#     is answered by reloading the page underneath the player.
Invoke-Probe "12 the recovery is not conditional on a real failure" "html" `
  "if (urls.length > 0 && claimRetry()) {" `
  "if (claimRetry()) {" `
  "a stale refusal in the browser's own cache is cured, not merely reported"

# 13. Back to one witness. This is the defect that reached production: a player holding a
#     four-hour-old `app.js` from before the flag existed has a working game wiped mid-round.
Invoke-Probe "13 the deadline trusts the flag alone" "html" `
  "if (window.__circuitLoaded || gameHasPainted()) return;" `
  "if (window.__circuitLoaded) return;" `
  "the watchdog never takes down a game that is running"

# 14. The loading screen counts as painted, so the second witness always says "alive" and the
#     watchdog can never fire at all - a guard that reads correctly and is switched off.
Invoke-Probe "14 the loading screen counts as proof of life" "html" `
  'if (screens[i].id !== "screen-loading" && !screens[i].hidden) return true;' `
  "if (!screens[i].hidden) return true;" `
  "the watchdog never takes down a game that is running"

# 15. A screen ships visible. Nothing fails, nothing logs, and the watchdog is retired silently
#     because `gameHasPainted` is true at zero seconds.
Invoke-Probe "15 a second screen ships without hidden" "html" `
  '<section id="screen-intro" class="screen scroll" hidden>' `
  '<section id="screen-intro" class="screen scroll">' `
  "the document starts on the loading screen and nothing else"

# 7. A refused asset becomes cacheable again, so a 404 outlives the deploy that fixed it.
Invoke-Probe "7 a 404 may be cached" "page" `
  '    res.setHeader("Cache-Control", "no-store");' `
  '' `
  "a refused asset is never remembered by a cache"

Write-Host ""
Write-Host "Done. All three files restored."
