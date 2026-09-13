# Probes for the guards behind the owner's 11 September 2026 rejection of the arena hero:
# "the current banner is far too tall and has unnecessary content/cards underneath... TARGET: a
# single compact horizontal banner, approximately 110-125px high on desktop" - then, on seeing 118, "the icons and info needs to be bigger... you may need to make the banner bigger."
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
$PRESENTATION = 'lib/services/games/game-presentation.service.ts'
$ADMIN_FIELDS = 'apps/admin/lib/admin/game-content-fields.ts'
$DIALOG = 'apps/admin/components/admin/games/GameContentDialog.tsx'

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
    From = 'className="relative px-4 py-3 sm:h-[150px] sm:px-[18px] sm:py-2"'
    To   = 'className="relative min-h-[220px] p-5 sm:p-7"'
    Test = 'fixes the height rather than flooring it'
  },
  @{
    # THE PLAUSIBLE HALF-FIX, and the one most likely to be written by somebody tidying up: the
    # fixed height stays, reading as though it governs, with a floor beside it that wins.
    Name = 'a minimum height is added beside the fixed one'
    File = $LAYOUT
    From = 'className="relative px-4 py-3 sm:h-[150px]'
    To   = 'className="relative min-h-[180px] px-4 py-3 sm:h-[150px]'
    Test = 'fixes the height rather than flooring it'
  },
  @{
    # The owner named the padding too - 8px/18px against the previous `p-5 sm:p-7`. Padding is
    # height, and 28px of it top and bottom is a quarter of the banner.
    Name = 'the generous padding comes back'
    File = $LAYOUT
    From = 'sm:h-[150px] sm:px-[18px] sm:py-2"'
    To   = 'sm:h-[150px] p-5 sm:px-[18px]"'
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
    From = 'className="mt-0.5 truncate text-[21px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[25px]"'
    To   = 'className="mt-0.5 text-[21px] font-bold uppercase italic leading-tight tracking-wide text-white sm:text-[25px]"'
    Test = 'clamps the copy to the lines the height affords'
  },
  @{
    # THE CONTROL FOR THE COUNT. `truncate` appears on three lines, so a guard asserting the
    # file merely contains it is satisfied by the heading while the tagline below it wraps.
    # This probe removes a DIFFERENT one, and it must still go red.
    Name = 'the tagline wraps while the heading still truncates'
    File = $IDENTITY
    From = 'className="mt-0.5 truncate text-[11px] font-semibold text-sky-300 sm:text-[12px]"'
    To   = 'className="mt-0.5 text-[11px] font-semibold text-sky-300 sm:text-[12px]"'
    Test = 'clamps the copy to the lines the height affords'
  },
  @{
    # The description is a 2,000-character operator field. It is TWO lines since the owner's
    # second message - one cut the live title's copy mid-sentence, which reads as a rendering
    # fault - and a third is three quarters of the banner, which is what the version before
    # the first rejection gave it.
    Name = 'the description is allowed three lines again'
    File = $IDENTITY
    From = 'className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-400 sm:text-[11px]"'
    To   = 'className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-gray-400 sm:text-[11px]"'
    Test = 'clamps the copy to the lines the height affords'
  },
  @{
    # THE CONTROL IN THE OTHER DIRECTION, and it is the one this slice needed. The owner asked
    # for the description to SHOW; a guard that only forbids three lines is equally happy with
    # the one line that was cutting it off, so the two-line spelling is asserted present too.
    Name = 'the description goes back to one clipped line'
    File = $IDENTITY
    From = 'className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-400 sm:text-[11px]"'
    To   = 'className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-gray-400 sm:text-[11px]"'
    Test = 'clamps the copy to the lines the height affords'
  },

  # ---- The features -----------------------------------------------------------------------
  @{
    # THE OTHER HALF OF THE DEFECT, restored. Bordered, padded, tinted cards are what made
    # three small facts read as a second section underneath the banner rather than as part of
    # it - and a box needs padding, which is height.
    Name = 'the features go back to being bordered cards'
    File = $IDENTITY
    From = 'className="flex w-[92px] flex-col items-center gap-1.5 text-center"'
    To   = 'className="flex flex-col items-center gap-1.5 rounded-lg border border-violet-500/20 bg-black/40 px-2 py-3 text-center"'
    Test = 'draws the features as icon and label, never as cards'
  },
  @{
    # THE OWNER'S SECOND MESSAGE WAS THAT THESE ARE TOO SMALL, so the probe now restores the
    # size that produced that reply rather than the kit's. The kit's `NEON_LABEL` is still
    # wrong here and for the same reason - 11px with wide tracking needs three lines for
    # "Global leaderboard" in a column this width - which is why the deviation is recorded in
    # the component rather than proposed for the kit.
    Name = 'the labels go back to the size the owner rejected'
    File = $IDENTITY
    From = 'className="text-[10px] font-bold uppercase leading-tight tracking-wide text-gray-200"'
    To   = 'className="text-[8px] font-bold uppercase leading-tight tracking-wider text-gray-300"'
    Test = 'draws the features as icon and label, never as cards'
  },
  @{
    # The glyph half. "The icons and info needs to be bigger" was about the picture first, and
    # a guard that only reads the label is satisfied while the icon stays at its old size.
    Name = 'the feature glyph goes back to its old size'
    File = $IDENTITY
    From = '<Icon className="h-6 w-6 text-sky-300" />'
    To   = '<Icon className="h-3.5 w-3.5 text-sky-300" />'
    Test = 'draws the features as icon and label, never as cards'
  },

  # ---- The logo ---------------------------------------------------------------------------
  @{
    # "the game logo bigger", and the box is only half of it: the picture lives inside a grid
    # track, so a bigger box in a 132px column is a bigger box that is clipped.
    Name = 'the logo box shrinks back inside its track'
    File = $IDENTITY
    From = 'sm:h-[120px] sm:w-[168px]'
    To   = 'sm:h-[60px] sm:w-[132px]'
    Test = 'gives the logo a track the artwork actually fills'
  },
  @{
    # The other half. A track narrowed under a box sized for it leaves the logo cropped by the
    # column - and the banner still measures 150px, so every height guard stays green.
    Name = 'the logo track narrows under the box'
    File = $IDENTITY
    From = 'sm:grid-cols-[168px_minmax(0,1fr)]'
    To   = 'sm:grid-cols-[132px_minmax(0,1fr)]'
    Test = 'gives the logo a track the artwork actually fills'
  },
  @{
    # THE FALLBACK IS THE COMMON CASE. No title in the catalogue has uploaded a logo, so a
    # monogram left at its old size is a shrunken initial in a box sized for something else -
    # on every hero rather than on the rare one.
    Name = 'the monogram is left at its old size'
    File = $IDENTITY
    From = 'sm:h-[112px] sm:w-[112px] sm:text-4xl'
    To   = 'sm:h-[60px] sm:w-[60px] sm:text-4xl'
    Test = 'gives the logo a track the artwork actually fills'
  },

  # ---- The artwork ------------------------------------------------------------------------
  @{
    # Without a track held back for the picture the copy runs underneath it, so a player reads
    # a tagline over a trophy. The banner still measures 118px, so the height guards are silent.
    Name = 'the copy runs under the artwork'
    File = $IDENTITY
    From = 'xl:grid-cols-[168px_minmax(0,1fr)_330px]'
    To   = 'xl:grid-cols-[168px_minmax(0,1fr)]'
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
  },

  # ---- The strip an operator writes -------------------------------------------------------
  @{
    # THE ONE THAT WOULD HAVE SHIPPED AS A DEFECT. No title carries authored features, so
    # reading an unset field as "show none" strips four facts off every hero in the catalogue
    # the day it lands - with nothing failing, nothing logged and no wrong number anywhere.
    Name = 'an empty strip is read as an empty banner'
    File = $FACTS
    From = '  if (written.length > 0) return written;'
    To   = '  if (Array.isArray(authored)) return written;'
    Test = 'works the four out when nothing is written'
  },
  @{
    # The other direction. A merge reads as generous and leaves an operator unable to tell
    # which two lines are theirs, or to remove ours.
    Name = 'the authored strip is merged with the derived four'
    File = $FACTS
    From = '  if (written.length > 0) return written;'
    To   = '  if (written.length >= 4) return written;'
    Test = 'replaces all four when even one is written'
  },
  @{
    # An unrecognised slug must lose its picture and KEEP its row: the label is the operator's
    # statement and the icon is decoration beside it.
    Name = 'a row with an unknown glyph is dropped'
    File = $FACTS
    From = '        .filter((row) => row.label !== "")'
    To   = '        .filter((row) => row.label !== "" && row.icon !== undefined)'
    Test = 'keeps the words when it does not know the glyph'
  },
  @{
    # A glyph the picker offers and the banner cannot draw renders a neutral mark on the live
    # page while the admin screen shows the operator the icon they chose.
    Name = 'a glyph the picker offers is missing from the banner'
    File = $IDENTITY
    From = '  ["reward", Trophy],'
    To   = ''
    Test = 'offers no glyph the banner cannot draw'
  },
  @{
    # An unknown icon slug must be REFUSED, where an unknown genre is normalised. Nothing but
    # this dialog has ever written a slug, so there is no legitimate writer to protect.
    Name = 'an unknown icon is accepted as written'
    File = $ADMIN_FIELDS
    From = '      if (!isHeroFeatureIcon(row.icon)) {'
    To   = '      if (false) {'
    Test = 'refuses an icon the picker does not offer'
  },
  @{
    # THE PROJECTION IS THE ONE MENTION THAT DECIDES WHETHER A VALUE ARRIVES. Stored,
    # operator-editable and selected by nothing is the rules-text defect exactly.
    Name = 'the strip is stored and never read back'
    File = $PRESENTATION
    From = 'highlights heroFeatures family'
    To   = 'highlights family'
    Test = 'reads the strip back out of the catalogue'
  },
  @{
    # The sentence is the feature: neither "empty means we work them out" nor "one replaces all
    # four" is guessable from a list of inputs, and both are decisions an operator must make.
    Name = 'the dialog stops explaining what an empty strip does'
    File = $DIALOG
    From = 'works them out'
    To   = 'leaves them out'
    Test = 'tells the operator what an empty strip does'
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
