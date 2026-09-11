# Probes for the guards behind the owner's 11 September 2026 rejection of the arena hero:
# "the current banner is far too tall and has unnecessary content/cards underneath... TARGET: a
# single compact horizontal banner, approximately 110-125px high on desktop."
#
# EVERY DEFECT PROBED HERE RENDERS PERFECTLY AND REPORTS SUCCESS. A banner that grows to fit
# its copy, a wrapped heading pushing a tagline out of view, three bordered cards where four
# small labels belong, a trophy hidden behind a dim copy of itself - none of them throws, logs
# or fails a typecheck. The only witness is a screenshot, which is why the owner found this
# twice before a guard existed.
#
# Harness rules, every one of which has produced a false result on this codebase before:
#   * -LiteralPath on the READ as well as the write, or a path containing `[id]` matches
#     nothing while Set-Content happily truncates the file.
#   * UTF-8 without a BOM both ways.
#   * Refuse to write empty content.
#   * Name the expected failing test, run it alone with -t, and treat "no test matched" as a
#     BROKEN PROBE rather than as a pass - a probe aimed at the wrong test is indistinguishable
#     from a guard that does not work.
#   * The -t filter is a REGEX, so the fragments below avoid brackets, pipes and apostrophes.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/arena-hero.test.ts'

$LAYOUT = 'components/games/arena/GameArenaLayout.tsx'
$IDENTITY = 'components/games/arena/ArenaIdentity.tsx'
$FACTS = 'components/games/arena/arena-facts.ts'

function Read-Source([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($resolved, $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($text)) { throw "Read of $Path returned nothing." }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { throw "Refusing to write empty content to $Path." }
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($resolved, $Text, $Utf8NoBom)
}

function To-Pattern([string]$Literal) {
  return [Regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

$probes = @(
  # ---- The height -------------------------------------------------------------------------
  @{
    # THE DEFECT ITSELF, restored verbatim. A minimum height is a floor content may exceed, so
    # the banner is as tall as whatever the catalogue happens to contain - which is how 220
    # became the header the owner photographed, one reasonable addition at a time.
    Name = 'the banner goes back to a minimum height it can exceed'
    File = $LAYOUT
    From = 'className="relative px-4 py-3 sm:h-[118px] sm:px-[18px] sm:py-2"'
    To   = 'className="relative min-h-[220px] p-5 sm:p-7"'
    Test = 'fixes the height rather than flooring it'
  },
  @{
    # THE PLAUSIBLE HALF-FIX, and the one most likely to be written by somebody tidying up: the
    # fixed height stays, reading as though it governs, with a floor beside it that wins.
    Name = 'a minimum height is added beside the fixed one'
    File = $LAYOUT
    From = 'className="relative px-4 py-3 sm:h-[118px]'
    To   = 'className="relative min-h-[180px] px-4 py-3 sm:h-[118px]'
    Test = 'fixes the height rather than flooring it'
  },
  @{
    # The owner named the padding too - 8px/18px against the previous `p-5 sm:p-7`. Padding is
    # height, and 28px of it top and bottom is a quarter of the banner.
    Name = 'the generous padding comes back'
    File = $LAYOUT
    From = 'sm:h-[118px] sm:px-[18px] sm:py-2"'
    To   = 'sm:h-[118px] p-5 sm:px-[18px]"'
    Test = 'fixes the height rather than flooring it'
  },
  @{
    # A ceiling is only a ceiling if what exceeds it is hidden. Without this the copy simply
    # overflows the panel and paints on whatever is below it.
    Name = 'the banner stops cropping what exceeds it'
    File = $LAYOUT
    From = '{`${NEON_PANEL_LIT} relative mb-5 overflow-hidden`}'
    To   = '{`${NEON_PANEL_LIT} relative mb-5`}'
    Test = 'crops rather than letting anything spill'
  },

  # ---- The copy ---------------------------------------------------------------------------
  @{
    # THE CLAMP THAT MATTERS MOST. The heading is the longest line and the only one that can
    # wrap to three, and a wrap there pushes the tagline and description out of the banner -
    # where `overflow-hidden` hides them with nothing on screen to say so.
    Name = 'the heading wraps instead of truncating'
    File = $IDENTITY
    From = 'className="mt-0.5 truncate text-[19px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[22px]"'
    To   = 'className="mt-0.5 text-[19px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[22px]"'
    Test = 'clamps every line of operator copy to one'
  },
  @{
    # THE CONTROL FOR THE COUNT. `truncate` appears on three lines, so a guard asserting the
    # file merely contains it is satisfied by the heading while the tagline below it wraps.
    # This probe removes a DIFFERENT one, and it must still go red.
    Name = 'the tagline wraps while the heading still truncates'
    File = $IDENTITY
    From = 'className="mt-0.5 truncate text-[10px] font-semibold text-sky-300 sm:text-[11px]"'
    To   = 'className="mt-0.5 text-[10px] font-semibold text-sky-300 sm:text-[11px]"'
    Test = 'clamps every line of operator copy to one'
  },
  @{
    # The description is a 2,000-character operator field. Three lines of it is three quarters
    # of the banner, which is what the previous version gave it.
    Name = 'the description is allowed three lines again'
    File = $IDENTITY
    From = 'className="mt-0.5 line-clamp-1 text-[9px] leading-snug text-gray-400 sm:text-[10px]"'
    To   = 'className="mt-0.5 line-clamp-3 text-[9px] leading-snug text-gray-400 sm:text-[10px]"'
    Test = 'clamps every line of operator copy to one'
  },

  # ---- The features -----------------------------------------------------------------------
  @{
    # THE OTHER HALF OF THE DEFECT, restored. Bordered, padded, tinted cards are what made
    # three small facts read as a second section underneath the banner rather than as part of
    # it - and a box needs padding, which is height.
    Name = 'the features go back to being bordered cards'
    File = $IDENTITY
    From = 'className="flex w-[68px] flex-col items-center gap-1 text-center"'
    To   = 'className="flex flex-col items-center gap-1.5 rounded-lg border border-violet-500/20 bg-black/40 px-2 py-3 text-center"'
    Test = 'draws the features as icon and label, never as cards'
  },
  @{
    # The owner's range for these labels is 7-9px. The kit's `NEON_LABEL` is 11 with wide
    # tracking, which is the natural thing to reach for and makes each label three lines in a
    # 68px column - so the row grows and takes the banner with it.
    Name = 'the labels go back to the kit size'
    File = $IDENTITY
    From = 'className="text-[8px] font-bold uppercase leading-tight tracking-wider text-gray-300"'
    To   = 'className="text-[11px] font-bold uppercase leading-tight tracking-wider text-gray-300"'
    Test = 'draws the features as icon and label, never as cards'
  },

  # ---- The artwork ------------------------------------------------------------------------
  @{
    # Without a track held back for the picture the copy runs underneath it, so a player reads
    # a tagline over a trophy. The banner still measures 118px, so the height guards are silent.
    Name = 'the copy runs under the artwork'
    File = $IDENTITY
    From = 'xl:grid-cols-[132px_minmax(0,1fr)_330px]'
    To   = 'xl:grid-cols-[132px_minmax(0,1fr)]'
    Test = 'reserves the right-hand track so the copy stops before the artwork'
  },
  @{
    # POSITION, NOT PRESENCE. Both passes are absolutely positioned siblings with no z-index
    # between them, so they paint in document order: the full-width wash written second covers
    # the right-hand piece and the trophy disappears behind a 40%-opacity copy of itself.
    Name = 'the dim wash is painted over the trophy'
    File = $LAYOUT
    From = 'className="h-full w-full object-cover opacity-40"'
    To   = 'className="h-full w-full object-cover opacity-45"'
    Test = 'paints the full-width wash before the right-hand piece'
  },

  # ---- What the banner claims -------------------------------------------------------------
  @{
    # THE REFERENCE'S OWN FOURTH LABEL. It reads perfectly and is a promise this banner cannot
    # check: what a contest pays depends on its prize pool, and a free contest would carry it
    # too. A caption is a claim.
    Name = 'the reference reward promise is put on the banner'
    File = $FACTS
    From = 'features.push({ label: SKILL_CHIP.label, icon: "skill" });'
    To   = 'features.push({ label: "Big rewards", icon: "skill" });'
    Test = 'promises no reward it cannot check'
  },
  @{
    # The ceiling stated as the length. The contest's configured round can be shorter, so this
    # is a figure no player's clock agrees with - and it is the obvious wording.
    Name = 'the round ceiling is stated as the round length'
    File = $FACTS
    From = 'return `Up to ${Math.round(maxDurationSeconds / 60)} min`;'
    To   = 'return `${Math.round(maxDurationSeconds / 60)} min rounds`;'
    Test = 'says a round is fast only when the ceiling makes it so'
  },
  @{
    # A guessed length is a deadline the platform never set, and `0` is the value most likely
    # to arrive from a catalogue row nobody has filled in.
    Name = 'an undeclared ceiling is guessed at'
    File = $FACTS
    From = '    maxDurationSeconds <= 0'
    To   = '    maxDurationSeconds < 0'
    Test = 'says nothing at all when no ceiling is declared'
  },
  @{
    # Padding to four is how a screen starts making claims nothing backs - and the fourth
    # entry reads exactly as well as the three that are true.
    Name = 'the fourth feature is invented when nothing is declared'
    File = $FACTS
    From = '  else if (interaction) features.push({ label: interaction.label, icon: "speed" });'
    To   = '  else features.push({ label: interaction?.label ?? "Fast rounds", icon: "speed" });'
    Test = 'falls back to the declared shape rather than padding to four'
  },
  @{
    # The split. Rendered whole at heading size the live title runs the width of the page,
    # which is the fault this replaced - and the obvious spelling, splitting on the LAST colon,
    # is wrong for a name carrying two.
    Name = 'the name is no longer split at its colon'
    File = $FACTS
    From = '  const at = gameName.indexOf(":");'
    To   = '  const at = -1;'
    Test = 'splits a name at its own colon'
  },
  @{
    # A decorative colon must not produce a blank heading with the real name demoted beneath
    # it. Without the empty-half check, a name ending in a colon does exactly that.
    Name = 'a decorative colon produces an empty heading'
    File = $FACTS
    From = '  if (!title || !subtitle) return { title: gameName.trim(), subtitle: null };'
    To   = '  if (!title) return { title: gameName.trim(), subtitle: null };'
    Test = 'keeps the whole name when a half would be empty'
  },

  # ---- What left the banner ---------------------------------------------------------------
  @{
    # The contest's name was a fifth line repeating the link directly above the banner. The
    # assertion runs in both directions, because deleting the link as well takes the contest's
    # name off the screen altogether.
    Name = 'the back link loses the contest name'
    File = $LAYOUT
    From = 'Back to {competitionName}'
    To   = 'Back to the competition'
    Test = 'states the contest name once on the page, not twice'
  }
)

$failures = 0

foreach ($probe in $probes) {
  Write-Host ''
  Write-Host "PROBE: $($probe.Name)" -ForegroundColor Cyan

  $original = Read-Source $probe.File

  if ($original -notmatch (To-Pattern $probe.From)) {
    Write-Host "  DID NOT APPLY - pattern not found in $($probe.File)" -ForegroundColor Yellow
    $failures++
    continue
  }

  $broken = $original.Replace($probe.From, $probe.To)
  if ($broken -eq $original) {
    Write-Host "  DID NOT APPLY - $($probe.File) unchanged" -ForegroundColor Yellow
    $failures++
    continue
  }

  Write-Source $probe.File $broken

  $suite = if ($probe.ContainsKey('Suite')) { $probe.Suite } else { $Suite }

  try {
    $raw = & npx vitest run $suite -t "$($probe.Test)" 2>&1
    $out = (($raw | Out-String) -replace '\s+', ' ')
  } finally {
    Write-Source $probe.File $original
  }

  if ($out -match 'No test files found|Tests\s+no tests') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
    $red = [int]$Matches[1]
    if ($red -le 2) {
      Write-Host "  RED as expected ($red failed)" -ForegroundColor Green
    } else {
      Write-Host "  RED but $red tests failed - blast radius larger than expected" -ForegroundColor Yellow
      $failures++
    }
  } elseif ($out -notmatch 'Tests\s+\d+\s+passed') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } else {
    Write-Host '  GREEN - the guard is not doing its job' -ForegroundColor Red
    $failures++
  }
}

Write-Host ''
if ($failures -eq 0) {
  Write-Host "All $($probes.Count) probes behaved as expected." -ForegroundColor Green
} else {
  Write-Host "$failures of $($probes.Count) probes did not behave as expected." -ForegroundColor Red
}
