# Probes for the two guards added on 8 September 2026, after the play surface broke in production.
#
# WHAT HAPPENED, because it is the reason both guards exist. A 6 September build was serving a
# 7 September `public/play`. The files arrive with a `git pull`; the allowlist authorising them is
# TypeScript that only exists once `npm run build` has run. So `presentation.js` was on disk,
# imported by `app.js`, and answered with a JSON 404 - the browser then failed to evaluate the
# importer too, nothing ran, the page sat on its own boot spinner and never posted `ready`, and two
# players watched a loading state until they gave up. Nothing failed from the platform's side and
# no log line existed anywhere.
#
# Run from games-service:  powershell -File tools/probe-deploy-drift.ps1

. "$PSScriptRoot/probe-harness.ps1"

$SuitePlay = 'tools/test-play.ts'
$srcPage = 'src/http/play-page.ts'
$srcSweeper = 'src/callback/sweeper.ts'

$results = @()

Write-Host ""
Write-Host "The boot audit - a deployment checking its own two halves agree" -ForegroundColor Cyan

# The defect itself, reproduced. This is the only probe here that recreates the live failure rather
# than weakening the guard that watches for it, so two tests may legitimately go red: the boot audit
# and the existing walk of the import graph.
$results += Invoke-Probe -Name 'the allowlist loses a module that is still on disk' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  ["presentation.js", { file: "presentation.js", type: "text/javascript; charset=utf-8" }],' `
  -Replace '  // removed by probe' `
  -ExpectRed "this checkout's own play surface agrees with this build" `
  -MaxRed 2

# An audit that reports nothing is the shape this would most plausibly regress into - somebody
# "simplifying" the pure function while the boot caller and its message stay exactly as they read
# today, so the log stays silent and looks correct.
$results += Invoke-Probe -Name 'the audit stops reporting files it will not serve' `
  -Suite $SuitePlay -File $srcPage `
  -Find @'
    unserved: filesOnDisk
      .filter((file) => IMPORTABLE.test(file) && !servable.has(file))
      .sort(),
'@ `
  -Replace '    unserved: [],' `
  -ExpectRed 'a file this build will not serve is reported, and named'

# The reverse split - code newer than the files - is a different deploy mistake with the same
# consequence, and it needs its own half of the audit.
$results += Invoke-Probe -Name 'the audit stops reporting promised files that are absent' `
  -Suite $SuitePlay -File $srcPage `
  -Find '    missing: [...servable].filter((file) => !present.has(file)).sort(),' `
  -Replace '    missing: [],' `
  -ExpectRed 'an allowlisted file that is not on disk is reported the other way round'

# The false-alarm trap. `index.html` is served by its own route and is deliberately not in the
# allowlist, so an audit that diffs the whole directory prints an error on every boot - and a guard
# that cries wolf at every start is the line everyone learns to scroll past, including on the day it
# is right.
$results += Invoke-Probe -Name 'the audit stops excluding the document, so it fires on every boot' `
  -Suite $SuitePlay -File $srcPage `
  -Find '      .filter((file) => IMPORTABLE.test(file) && !servable.has(file))' `
  -Replace '      .filter((file) => !servable.has(file))' `
  -ExpectRed 'index.html is not reported, because it has its own route'

Write-Host ""
Write-Host "The sweeper - classifying a delivery failure rather than counting it" -ForegroundColor Cyan

# Silence restored. This is the state the service shipped in until 8 September: the reason was
# computed, returned, and dropped on the floor.
$results += Invoke-Probe -Name 'the failure reason is not logged at all' `
  -Suite $SuitePlay -File $srcSweeper `
  -Find '      if (outcome.reason !== "gave_up") {' `
  -Replace '      if (false) {' `
  -ExpectRed 'a delivery failure says WHY in the log, not merely that one happened'

# The subtler regression, and the one the test's shape is chosen for: a line that announces a
# failure without saying which failure. `delivery failed` would satisfy any check that merely asked
# whether something was logged, and leaves an operator exactly where `failed 1` left them.
$results += Invoke-Probe -Name 'the log announces a failure without naming it' `
  -Suite $SuitePlay -File $srcSweeper `
  -Find ': delivery failed - ${outcome.reason}`' `
  -Replace ': delivery failed`' `
  -ExpectRed 'a delivery failure says WHY in the log, not merely that one happened'

# Whether it will be tried again is the other half of an actionable line: "HTTP 401; not retrying"
# needs somebody now, "HTTP 500; will retry" usually does not.
$results += Invoke-Probe -Name 'the log stops saying whether it will retry' `
  -Suite $SuitePlay -File $srcSweeper `
  -Find '            (outcome.retryable ? "; will retry" : "; not retrying"),' `
  -Replace '            "",' `
  -ExpectRed 'a delivery failure says WHY in the log, not merely that one happened'

Write-ProbeSummary $results
