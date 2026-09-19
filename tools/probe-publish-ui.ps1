# Probes the publish-control slice by reintroducing each defect and confirming the suite goes
# red. Structural tests especially need this: they assert that source text is present, so a
# typo in the pattern produces a test that can never fail and reads as a passing guard.
#
# Same harness as tools/probe-gm-fee.ps1, and for the same reasons: a multi-line pattern with
# CRLF does not match an LF file, Out-String wraps long test names across lines so a literal
# match silently misses, and a probe that fails to apply is indistinguishable from a test that
# does not work.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/admin/provider-contest-publish-ui.test.ts'
$List = 'apps/admin/components/admin/CompetitionsListSection.tsx'
$Button = 'apps/admin/components/admin/games/PublishContestButton.tsx'
$Label = 'apps/admin/lib/admin/contest-game-label.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

  $original = Get-Content $File -Raw
  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $failed = 0
    if ($out -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    $flat = ($out -replace '\s+', ' ')
    $want = ($ExpectRed -replace '\s+', ' ')

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape($want)) { 'expected test' } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== the game label helper ===" -ForegroundColor Cyan

Probe -Name 'an absent label stops resolving to trading' `
  -File $Label `
  -Find '  const label = contest?.gameType;
  return typeof label === "string" && label.length > 0
    ? label
    : DEFAULT_GAME_TYPE;' `
  -Replace '  return contest?.gameType as string;' `
  -ExpectRed 'treats an absent label as trading, because .lean() skips the schema default'

Probe -Name 'an empty-string label stops counting as missing' `
  -File $Label `
  -Find 'typeof label === "string" && label.length > 0' `
  -Replace 'typeof label === "string"' `
  -ExpectRed 'treats an empty-string label as absent, which is a third missing-value shape'

Probe -Name 'the label match becomes a substring match' `
  -File $Label `
  -Find 'return resolveContestGameType(contest) === "provider";' `
  -Replace 'return resolveContestGameType(contest).includes("provider");' `
  -ExpectRed 'does not match a label that merely contains the word'

Write-Host "`n=== the publish button ===" -ForegroundColor Cyan

Probe -Name 'the accumulated refusal list is dropped, leaving only the summary' `
  -File $Button `
  -Find '        const list: string[] = Array.isArray(data.errors) ? data.errors : [];
        setRefusals(list);' `
  -Replace '        setRefusals([]);' `
  -ExpectRed 'renders every accumulated refusal, not just the summary line'

Probe -Name 'the refusal list is read but never rendered' `
  -File $Button `
  -Find '            {refusals.map((refusal) => (
              <li key={refusal} className="text-xs text-red-300/90">
                • {refusal}
              </li>
            ))}' `
  -Replace '            <li className="text-xs text-red-300/90">See the toast.</li>' `
  -ExpectRed 'renders every accumulated refusal, not just the summary line'

Probe -Name 'the actionable refusal is replaced by the generic message' `
  -File $Button `
  -Find '        toast.error(
          data.error ?? "Something went wrong. Please contact support.",
        );' `
  -Replace '        toast.error("Publishing failed.");' `
  -ExpectRed 'shows the provider''s own refusal text rather than a generic failure'

Probe -Name 'warnings are raised as errors, so a success reads as a failure' `
  -File $Button `
  -Find '        toast.warning(warning);' `
  -Replace '        toast.error(warning);' `
  -ExpectRed 'surfaces warnings without letting them read as failures'

Probe -Name 'warnings stop being surfaced at all' `
  -File $Button `
  -Find '      const warnings: string[] = Array.isArray(data.warnings)
        ? data.warnings
        : [];' `
  -Replace '      const warnings: string[] = [];' `
  -ExpectRed 'surfaces warnings without letting them read as failures'

Probe -Name 'the button stops disabling itself while in flight' `
  -File $Button `
  -Find '        disabled={pending}' `
  -Replace '        disabled={false}' `
  -ExpectRed 'disables itself while a publish is in flight'

Probe -Name 'an unpublish action is added' `
  -File $Button `
  -Find '  const handlePublish = async () => {' `
  -Replace '  const handleUnpublish = async () => { await fetch("/x"); };
  const handlePublish = async () => {' `
  -ExpectRed 'offers no unpublish, because a visible contest can already have been paid into'

Probe -Name 'the post goes to the wrong route' `
  -File $Button `
  -Find '        `/api/games/contests/${competitionId}/publish`,' `
  -Replace '        `/api/competitions/${competitionId}`,' `
  -ExpectRed 'posts to the publish route for the contest it was given'

Write-Host "`n=== the competitions list ===" -ForegroundColor Cyan

Probe -Name 'draft is removed from the status union again' `
  -File $List `
  -Find '  status: "draft" | "upcoming"' `
  -Replace '  status: "upcoming"' `
  -ExpectRed 'admits draft as a status, which the type used to deny'

Probe -Name 'draft goes back to the grey used for completed' `
  -File $List `
  -Find '      case "draft":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";' `
  -Replace '      case "draft":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";' `
  -ExpectRed 'gives draft its own colour rather than the grey used for completed'

Probe -Name 'the drafts summary card is removed' `
  -File $List `
  -Find '                {competitions.filter((c) => c.status === "draft").length}' `
  -Replace '                {competitions.length}' `
  -ExpectRed 'counts drafts in the summary, which enumerates statuses'

Probe -Name 'publish is offered on any draft, including a trading one' `
  -File $List `
  -Find '                {competition.status === "draft" &&
                  hasProviderGameLabel(competition) && (' `
  -Replace '                {competition.status === "draft" && (' `
  -ExpectRed 'shows the publish control only for a draft that is a provider contest'

Probe -Name 'publish is offered on a provider contest whatever its status' `
  -File $List `
  -Find '                {competition.status === "draft" &&
                  hasProviderGameLabel(competition) && (' `
  -Replace '                {hasProviderGameLabel(competition) && (' `
  -ExpectRed 'shows the publish control only for a draft that is a provider contest'

Probe -Name 'the row is patched locally instead of refetched' `
  -File $List `
  -Find '                      onPublished={fetchCompetitions}' `
  -Replace '                      onPublished={() => {}}' `
  -ExpectRed 'refetches after publishing rather than patching the row locally'

Probe -Name 'the trading editor is offered to provider contests again' `
  -File $List `
  -Find '                {hasProviderGameLabel(competition) ? (' `
  -Replace '                {false ? (' `
  -ExpectRed 'withholds the trading editor from provider contests'

# Re-aimed after this probe stayed green. It had been pointed at the "label-only helper" test,
# which asserts that the STRICT `isProviderContest` is not imported - a different claim, and one
# that the other two `hasProviderGameLabel` call sites keep satisfying. The badge had no test at
# all, which is a missing test rather than a weak one.
Probe -Name 'the game badge stops distinguishing a provider contest' `
  -File $List `
  -Find '                  {hasProviderGameLabel(competition) && (' `
  -Replace '                  {false && (' `
  -ExpectRed 'badges a provider contest so it is not read as a trading one'

Probe -Name 'the badge renders an empty label when gameKey has not been populated' `
  -File $List `
  -Find '                      {competition.gameKey ?? "Provider game"}' `
  -Replace '                      {competition.gameKey}' `
  -ExpectRed 'badges a provider contest so it is not read as a trading one'

Probe -Name 'the strict playability helper is imported instead' `
  -File $List `
  -Find 'import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";' `
  -Replace 'import { isProviderContest } from "@/lib/services/games/contest-config";
const hasProviderGameLabel = isProviderContest;' `
  -ExpectRed 'uses the label-only helper, never the strict playability one'

Write-Host ''
