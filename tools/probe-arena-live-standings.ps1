# Probes for "it is not showing live what a player finished".
#
# WHAT THIS SLICE DID, 11 September 2026: the arena's standings and recent-players panels were
# server props rendered once, so a round that landed while a player sat at the game appeared only
# after a reload. The obvious fix - mounting `LiveContestRefresher` - is FORBIDDEN here by a test,
# because `router.refresh()` re-renders the page under an iframe holding an attempt somebody has
# paid for. So the rail polls a JSON endpoint and swaps only its own panels.
#
# THE THREE CLAIMS WORTH PROBING are that the frame is outside the refreshing subtree, that the
# page and the poll compose the board through ONE producer, and that a bad response leaves the
# last good board on screen rather than emptying the rail.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage and writes the mojibake back.
#   * `-LiteralPath` semantics via `System.IO.File`, because these paths contain `[id]` and
#     PowerShell parses that as a wildcard character class. This harness touches TWO such paths,
#     so getting it wrong would empty a route and a page and report success.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern - a CRLF pattern never matches an LF file.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * `-t` IS A REGULAR EXPRESSION. Every expected name below is plain ASCII with no brackets.
#   * DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$DefaultSuite = '__tests__/games/live-contest-refresh.test.ts'
$PlayUiSuite = '__tests__/games/provider-play-ui.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    # PARAMETERISED ON THE SUITE, because one probe here proves a guard living in a different
    # file. Run against the wrong suite, `-t` matches nothing, vitest reports a PASSING run over
    # zero tests, and the probe reads GREEN - indistinguishable from a missing guard. That is
    # exactly what happened to the rank probe on the first run.
    [string]$Suite = $DefaultSuite
  )

  $path = Join-Path $Root $File
  $original = Read-Source $path
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "[$Name] UNREADABLE - $File came back empty, refusing to probe" -ForegroundColor Magenta
    return
  }

  $mutated = [regex]::Replace($original, (To-Relaxed $Find), { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] DID NOT APPLY - the target moved, so nothing was tested" -ForegroundColor Magenta
    return
  }

  Write-Source $path $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - wrong test name, or wrong suite" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Rail = 'components/games/arena/ArenaLiveStandings.tsx'
$Page = 'app/(root)/competitions/[id]/play/page.tsx'
$Route = 'app/api/competitions/[id]/standings/route.ts'

Write-Host ''
Write-Host '=== The game is outside the subtree that refreshes ===' -ForegroundColor Cyan

# THE ONE THAT MATTERS. The provider takes the rest of the arena as `children`, and a `children`
# element handed down from a server component is the same object on every re-render - so React
# never descends into it. Making the round host a consumer instead turns a board refresh into a
# reloaded game, under a player who has paid for the attempt.
Invoke-Probe -Name 'the round host reads the live context' -File $Rail `
  -Find 'export function ArenaLiveBoard({ scoreLabel }: { scoreLabel?: string }) {' `
  -Replace 'export function ProviderRoundHost() {
  useArenaLive();
  return null;
}

export function ArenaLiveBoard({ scoreLabel }: { scoreLabel?: string }) {' `
  -ExpectTest 'the round host is a child of the live provider, never a consumer of it'

# The provider must actually pass its children through. Rendering only the consumers would drop
# the whole arena, which no structural assertion about the fetch could notice.
Invoke-Probe -Name 'the children are dropped' -File $Rail `
  -Find '      {children}' `
  -Replace '      {null}' `
  -ExpectTest 'the round host is a child of the live provider, never a consumer of it'

Write-Host ''
Write-Host '=== One fetch, one producer ===' -ForegroundColor Cyan

# Two polls of one endpoint is two answers: the board could name a rival's finished round while
# the feed beside it had not heard of it.
Invoke-Probe -Name 'the feed fetches for itself' -File $Rail `
  -Find 'export function ArenaLiveFeed() {
  const { feed, currentUserId } = useArenaLive();' `
  -Replace 'export function ArenaLiveFeed() {
  const { feed, currentUserId } = { feed: [], currentUserId: "" };
  void fetch("/api/x");' `
  -ExpectTest 'fetches once for every panel that shows it'

# The page composing its own board is how the first render and the refresh come to disagree -
# and any field where they differ reads to the player as the value having changed.
#
# BOTH OF THESE FIRST INJECTED AN IMPORT AND CAME BACK GREEN, which is the fourth cause of a
# green probe: the mutation changed no observable. The assertion bans a CALL, and an import line
# reads `getCompetitionLeaderboard }` rather than `getCompetitionLeaderboard(`. The distinction
# is the right one to keep - importing a reader is harmless, composing a second answer with it
# is the defect - so the probes were re-aimed at a call rather than the assertion loosened.
Invoke-Probe -Name 'the page composes its own board' -File $Page `
  -Find '    getArenaStandings(competitionId, session.user.id, {' `
  -Replace '    getCompetitionLeaderboard(competitionId, 25),
    getArenaStandings(competitionId, session.user.id, {' `
  -ExpectTest 'the page and the route compose the board through the same service'

# The route is the other half of the same claim.
Invoke-Probe -Name 'the route composes its own board' -File $Route `
  -Find '    const standings = await getArenaStandings(id, session.user.id);' `
  -Replace '    await getContestActivity(id, []);
    const standings = await getArenaStandings(id, session.user.id);' `
  -ExpectTest 'the page and the route compose the board through the same service'

# Rendering a panel directly is how half the rail goes back to being a photograph while every
# assertion about the fetch stays green.
# RE-AIMED 11 Sep 2026: the feed moved out of the sidebar into the reference's bottom band, so
# the old pattern carried the sidebar's indentation and reported DID NOT APPLY - which reads like
# a broken harness rather than a moved target. Matched without leading whitespace now, so the
# next move of the slot cannot silence it again.
Invoke-Probe -Name 'the page renders a panel directly' -File $Page `
  -Find 'activity={<ArenaLiveFeed />}' `
  -Replace 'activity={<ArenaActivityFeed entries={standings.feed} currentUserId={session.user.id} />}' `
  -ExpectTest 'the page renders the consumers rather than the panels directly'

Write-Host ''
Write-Host '=== Liveness is the server''s answer, not the browser''s ===' -ForegroundColor Cyan

# A contest whose end time has passed is still `active` until a cron finalizes it, so a client
# deciding for itself freezes the board exactly while the last rounds are being scored - which
# reads as MORE accurate, and is why this is probed.
Invoke-Probe -Name 'the browser decides whether the contest is running' -File $Page `
  -Find '      active={outcome.state.contestStatus === "active"}' `
  -Replace '      active={Date.now() < new Date(outcome.state.endTime ?? 0).getTime()}' `
  -ExpectTest 'liveness comes from the stored status, not from a clock in the browser'

# Without the gate it polls a finished contest for as long as the tab is open.
Invoke-Probe -Name 'a finished contest is still polled' -File $Rail `
  -Find '    if (!active) return;' `
  -Replace '' `
  -ExpectTest 'liveness comes from the stored status, not from a clock in the browser'

Write-Host ''
Write-Host '=== A bad answer leaves the last good board on screen ===' -ForegroundColor Cyan

# An error payload spread into state empties the rail, and an empty rail on THIS screen says
# "nobody has played" - a false statement about a contest in progress rather than a missing one.
Invoke-Probe -Name 'an error payload is rendered as a board' -File $Rail `
  -Find '        if (!Array.isArray(data?.rows)) return;' `
  -Replace '' `
  -ExpectTest 'ignores a response that is not a board'

Invoke-Probe -Name 'a non-200 response is parsed anyway' -File $Rail `
  -Find '        if (!response.ok) return;' `
  -Replace '' `
  -ExpectTest 'ignores a response that is not a board'

Write-Host ''
Write-Host '=== The timer and the listener come down with the component ===' -ForegroundColor Cyan

# Sharing another effect's flag lets its cleanup silence this one, with no error and nothing in
# a log.
Invoke-Probe -Name 'the mounted flag is dropped' -File $Rail `
  -Find '        if (!mounted) return;' `
  -Replace '' `
  -ExpectTest 'tears its own timer and listener down'

Invoke-Probe -Name 'the interval leaks' -File $Rail `
  -Find '      clearInterval(timerRef.current);' `
  -Replace '      void timerRef.current;' `
  -ExpectTest 'tears its own timer and listener down'

Write-Host ''
Write-Host '=== The endpoint refuses before it reads ===' -ForegroundColor Cyan

# Two indexed reads per request against any guessable contest id is not something to hand out
# unauthenticated, even though the board itself is public on the lobby.
Invoke-Probe -Name 'the route is unauthenticated' -File $Route `
  -Find '    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }' `
  -Replace '' `
  -ExpectTest 'the route is guarded and refuses a junk id first'

# Refusing the shape AFTER the session read bounces a crawler following a bad in-app link through
# authentication for a contest that cannot exist.
Invoke-Probe -Name 'a junk id reaches the database' -File $Route `
  -Find '    if (!isCompetitionIdShaped(id)) {
      logMalformedCompetitionId("GET /api/competitions/[id]/standings", id);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }' `
  -Replace '' `
  -ExpectTest 'the route is guarded and refuses a junk id first'

Write-Host ''
Write-Host '=== The rank is still read, not worked out ===' -ForegroundColor Cyan

# R37 in its new home: the lookup moved into the shared service when the rail went live, so the
# guard moved with it. A page that re-derives a rank beside a service that resolves one is the
# "one rule, two copies" shape.
Invoke-Probe -Name 'the rank is re-derived on the page' -File $Page `
  -Find '              rank={standings.yourRank}' `
  -Replace '              rank={standings.rows.find((r) => r.userId === session.user.id)?.currentRank}' `
  -ExpectTest 'takes currentRank off the matching row' -Suite $PlayUiSuite

Write-Host ''
Write-Host 'Done. Every probe above must read RED with exactly 1 failure.' -ForegroundColor Cyan
Write-Host 'GREEN means the guard is absent, weak, unreachable, or the mutation changed no observable.' -ForegroundColor DarkGray
