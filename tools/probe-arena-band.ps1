# Probes for the guards behind the owner's 11 September 2026 rejection of the arena band:
# "the complete section should only be approximately 90-105px tall on desktop. Your current
# implementation stretches the section to approximately 600px+ high. THIS IS WRONG."
#
# EVERY DEFECT PROBED HERE RENDERS PERFECTLY AND REPORTS SUCCESS. A card that grows to fit its
# text, a fifth tip silently clipped, a picture at full width, a two-line player row - none of
# them throws, logs or fails a typecheck. The only witness is a screenshot, which is why the
# owner found this three times before a guard existed.
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
$Suite = '__tests__/games/arena-band.test.ts'

$LAYOUT = 'components/games/arena/GameArenaLayout.tsx'
$RULES = 'components/games/GameRulesPanel.tsx'
$HIGHLIGHTS = 'components/games/arena/ArenaHighlights.tsx'
$FEED = 'components/games/arena/ArenaActivityFeed.tsx'
$CARDS = 'components/neon/Cards.tsx'
$AVATAR = 'components/neon/LeaderboardRow.tsx'
$FIELDS = 'apps/admin/lib/admin/game-content-fields.ts'
$DIALOG = 'apps/admin/components/admin/games/GameContentDialog.tsx'
# The `[id]` is why every read uses -LiteralPath.
$PLAY_PAGE = 'app/(root)/competitions/[id]/play/page.tsx'

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
  # ---- The band's height -------------------------------------------------------------------
  @{
    # THE DEFECT ITSELF, restored. Without a height the row is as tall as its tallest card and
    # every card is as tall as its own text - which is the whole 600px section, with no rule
    # broken anywhere and nothing to see in a diff.
    Name = 'the band goes back to growing with its content'
    File = $LAYOUT
    From = 'className="mt-4 flex flex-wrap items-stretch gap-2.5 sm:h-[104px]"'
    To   = 'className="mt-4 flex flex-wrap items-stretch gap-2.5"'
    Test = 'pins its own height instead of growing with its content'
  },
  @{
    # THE PLAUSIBLE HALF-FIX. The reference measures 986 wide, so scaling the height with the
    # viewport reads correctly at that width and turns the strip back into a section at 1440 -
    # which is exactly what the owner's "do not scale the height proportionally" forbids.
    Name = 'the height scales up with the viewport'
    File = $LAYOUT
    From = 'gap-2.5 sm:h-[104px]"'
    To   = 'gap-2.5 sm:h-[104px] lg:h-48"'
    Test = 'pins its own height instead of growing with its content'
  },
  @{
    # One of the four spellings the instruction named by name. A minimum height under a fixed
    # height is the fixed height losing.
    Name = 'a minimum height creeps back onto a card'
    File = $LAYOUT
    From = '<div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">'
    To   = '<div className="min-w-[260px] min-h-[320px] flex-[1_1_0] empty:hidden [&>*]:h-full">'
    Test = 'carries none of the vertical-fill spellings the owner ruled out'
  },
  @{
    # THE CONTROL FOR THE ASSERTION ABOVE. `h-full` is banned on the band and REQUIRED on each
    # wrapper, so the guard is a count rather than a word - written as a word it fires on the
    # child selector, which it did, on correct code, the first time the suite ran.
    Name = 'the band takes a height of its own on top of the fixed one'
    File = $LAYOUT
    From = 'className="mt-4 flex flex-wrap items-stretch gap-2.5 sm:h-[104px]"'
    To   = 'className="mt-4 flex h-full flex-wrap items-stretch gap-2.5 sm:h-[104px]"'
    Test = 'carries none of the vertical-fill spellings the owner ruled out'
  },
  @{
    # The proportions. `flex-1` on all three is the natural spelling and gives 33/33/33, which
    # is close enough to look right and wrong enough that the players card, which has the least
    # to say, is the same width as the two that have the most.
    Name = 'the three cards share the row equally instead of 34 34 32'
    File = $LAYOUT
    From = 'className="min-w-[260px] flex-[1_1_0] empty:hidden'
    To   = 'className="min-w-[260px] flex-[1.15_1_0] empty:hidden'
    Test = 'divides the row 34 34 32, the reference proportions'
  },
  @{
    # Three cards at 320 plus two gaps needs 980, so the band stacks on a laptop - and it
    # stacks into three 96px rows, because the height is `sm:` and a laptop is not a phone.
    Name = 'the minimum width grows until the row cannot hold three'
    File = $LAYOUT
    From = 'min-w-[260px] flex-[1.15_1_0] empty:hidden [&>*]:h-full">
          {rules}'
    To   = 'min-w-[320px] flex-[1.15_1_0] empty:hidden [&>*]:h-full">
          {rules}'
    Test = 'keeps all three cards on one row at every width the owner called desktop'
  },

  # ---- The caps ----------------------------------------------------------------------------
  @{
    # A LIMIT DECLARED AND NOT APPLIED. `overflow-hidden` then does the work, so the fourth
    # step is simply not painted - and the panel looks entirely correct on every title whose
    # operator happened to write three.
    Name = 'the rules card stops slicing and relies on overflow'
    File = $RULES
    From = 'paragraphs(text).slice(0, STRIP_STEP_LIMIT)'
    To   = 'paragraphs(text)'
    Test = 'the rules card names its limit and slices by it'
  },
  @{
    Name = 'the tips card draws every highlight it is given'
    File = $HIGHLIGHTS
    From = 'highlights.slice(0, STRIP_TIP_LIMIT)'
    To   = 'highlights'
    Test = 'the tips card names its limit and slices by it'
  },
  @{
    Name = 'the players card draws the whole feed'
    File = $FEED
    From = '.slice(0, FEED_LIMIT)'
    To   = ''
    Test = 'the players card names its limit and slices by it'
  },
  @{
    # THE OTHER HALF OF THE CAP, and the half a reviewer drops. Four tips of two lines each is
    # eight rows in a panel with room for four - so the cap is satisfied and the card is the
    # same height it was before.
    Name = 'a tip is allowed to wrap onto a second line'
    File = $HIGHLIGHTS
    From = 'className="truncate text-[10px] leading-tight text-gray-300"'
    To   = 'className="text-[10px] leading-tight text-gray-300"'
    Test = 'clamps every line and keeps the full text reachable'
  },
  @{
    # Clamping without a tooltip is not a clamp, it is a deletion: a cut sentence with no way
    # to read the rest is the same failure as an uncapped list, one step quieter.
    Name = 'the clamped tip loses the tooltip that makes it readable'
    File = $HIGHLIGHTS
    From = '                title={highlight.detail || highlight.title}
'
    To   = ''
    Test = 'clamps every line and keeps the full text reachable'
  },
  @{
    # The owner's "do not make each row 60px high". The name sat ABOVE the phrase, which is
    # 44px of stacked text per player before padding.
    Name = 'the player row stacks the name above what they did'
    File = $FEED
    From = '              <NeonAvatar name={name} size="xs" />'
    To   = '              <NeonAvatar name={name} size="sm" />'
    Test = 'puts the player name and what they did on ONE line'
  },
  @{
    # `describeRoundActivity` returns metrics for the results screen, where there is a column
    # for them. Appended to a one-line row they are what makes a second line necessary.
    Name = 'the metrics come back onto the compact row'
    File = $FEED
    From = '              {typeof entry.activity.score === "number" && ('
    To   = '              <span>{phrase.metrics}</span>
              {typeof entry.activity.score === "number" && ('
    Test = 'puts the player name and what they did on ONE line'
  },
  @{
    # The kit half of the same claim. The feed asking for `xs` is green whatever `xs` means,
    # so this widens the chip in the kit and leaves the request untouched.
    Name = 'the compact avatar quietly becomes the full-size one'
    File = $AVATAR
    From = '      ? "h-5 w-5 text-[8px]"'
    To   = '      ? "h-8 w-8 text-[8px]"'
    Test = 'draws the avatar at the size the compact row has room for'
  },
  @{
    # The other half of the row height, and the quietest failure on the card: at `py-1` a row
    # is 28px, three of them no longer fit the body, and the third disappears under
    # `overflow-hidden` while `FEED_LIMIT` still reads 3 two lines away.
    Name = 'the feed rows go back to a padding three of them do not fit'
    File = $FEED
    From = 'className="flex items-center gap-2 px-2.5 py-0.5"'
    To   = 'className="flex items-center gap-2 px-2.5 py-1"'
    Test = 'gives each row only the padding three of them fit into'
  },

  # ---- The pictures ------------------------------------------------------------------------
  @{
    # A PERCENTAGE OF A FLEXIBLE COLUMN is exactly how the rules diagram became a full-width
    # hero the first time. It reads as responsive and it is the defect.
    Name = 'the rules diagram is sized as a proportion again'
    File = $RULES
    From = '<div className="hidden w-[66px] shrink-0 sm:block">'
    To   = '<div className="hidden w-1/3 shrink-0 sm:block">'
    Test = 'the rules card draws it at a fixed size'
  },
  @{
    Name = 'the tips emblem is sized as a proportion again'
    File = $HIGHLIGHTS
    From = '<div className="hidden w-[88px] shrink-0 sm:block">'
    To   = '<div className="hidden w-1/3 shrink-0 sm:block">'
    Test = 'the tips card draws it at a fixed size'
  },
  @{
    # POSITION, NOT PRESENCE. The rejected build had both pictures in the right components and
    # in the wrong place, so a test asserting the illustration exists is green on the defect.
    # In a flex row the later element is the right-hand one.
    Name = 'the tips emblem moves back above the lines'
    File = $HIGHLIGHTS
    From = '      <div className="flex h-full items-center gap-2.5 px-2.5 py-1">'
    To   = '      <div className="flex h-full flex-col items-center gap-2.5 px-2.5 py-1">'
    Test = 'the tips card draws it AFTER the text, not above it'
  },
  @{
    # A crop takes the corners off a badge. `cover` is right for the two slots that already
    # existed - a logo and a hero banner - and wrong for a keyed-out graphic.
    Name = 'the picture is cropped to fill its frame'
    File = $CARDS
    From = 'fit === "contain" ? "object-contain" : "object-cover"'
    To   = '"object-cover"'
    Test = 'keeps the whole picture visible rather than cropping it'
  },
  @{
    # THE CONTROL IN THE OTHER DIRECTION. Flipping the default to `contain` letterboxes every
    # banner and logo on both lobbies, which is a change to screens nobody asked to touch.
    Name = 'contain becomes the default for every slot'
    File = $CARDS
    From = '  fit = "cover",'
    To   = '  fit = "contain",'
    Test = 'keeps the whole picture visible rather than cropping it'
  },

  # ---- The heading strip -------------------------------------------------------------------
  @{
    # The default strip is about 34px of a 96px card, so a third of the panel goes on its own
    # title before a line of content is drawn.
    Name = 'one card keeps the tall heading strip'
    File = $FEED
    From = '      title="Recent players"
      dense
'
    To   = '      title="Recent players"
'
    Test = 'is asked for by all three cards'
  },
  @{
    # A heading that wraps inside a fixed-height card pushes a line of content off the bottom,
    # which is content disappearing to make room for a title.
    Name = 'the dense heading is allowed to wrap'
    File = $CARDS
    From = 'dense ? "truncate" : ""'
    To   = '""'
    Test = 'is a prop on the kit panel rather than a second strip'
  },
  @{
    # THE NEGATIVE HALF, as everywhere in this kit: importing the panel is trivially satisfied
    # by a screen that hand-rolls a heading strip of its own beside it.
    Name = 'a card hand-rolls the heading strip instead of asking for it'
    File = $HIGHLIGHTS
    From = '      <div className="flex h-full items-center gap-2.5 px-2.5 py-1">'
    To   = '      <div className="px-3 py-1.5">Game tips</div>
      <div className="flex h-full items-center gap-2.5 px-2.5 py-1">'
    Test = 'does not put the heading strip own classes in a consumer'
  },

  # ---- The wording, and the decision it reverses -------------------------------------------
  @{
    # The owner asked for GAME TIPS twice. The reversal is asserted in both directions, because
    # the heading it replaced was a deliberate decision rather than an oversight.
    Name = 'the middle card goes back to What to expect'
    File = $HIGHLIGHTS
    From = 'title="Game tips"'
    To   = 'title="What to expect"'
    Test = 'heads the middle card GAME TIPS'
  },
  @{
    # `How Circuit Sprint: fast and fun spatial puzzles is scored` is a heading longer than the
    # card is wide, and a heading that wraps costs a step. The full panel still names the game.
    Name = 'the compact card names the game in its heading'
    File = $RULES
    From = '<NeonHeadedPanel icon={BookOpen} title="How it works" dense>'
    To   = '<NeonHeadedPanel icon={BookOpen} title={`How ${gameName} works`} dense>'
    Test = 'heads the left card HOW IT WORKS, without the game name'
  },
  @{
    # THE GUARD THAT MATTERS MOST HERE. The owner's target copy is game-specific - "connect
    # matching numbers with a path" - and writing it as a literal is what the arena's agnostic
    # rule exists to stop, because a tetris title has no numbers to connect.
    Name = 'the steps are hard-coded instead of read from the catalogue'
    File = $RULES
    From = '  const steps = paragraphs(text).slice(0, STRIP_STEP_LIMIT);'
    To   = '  const steps = ["Connect matching numbers with a path", "Fill the entire board", "Solve before time runs out"];'
    Test = 'names no game anywhere in the three cards'
  },

  # ---- The dead layout, and the number the operator is told --------------------------------
  @{
    # A prop with one legal value is a prop that does not exist yet - accepted at the call
    # site, destructured nowhere, read by nothing.
    Name = 'the highlights panel takes a layout prop again'
    File = $HIGHLIGHTS
    From = '  imageUrl?: string;
}'
    To   = '  imageUrl?: string;
  layout?: "strip";
}'
    Test = 'leaves ArenaHighlights with one shape'
  },
  @{
    Name = 'the play page passes a layout the panel ignores'
    File = $PLAY_PAGE
    From = '            highlights={presentation.highlights}'
    To   = '            highlights={presentation.highlights}
            layout="strip"'
    Test = 'has the play page ask the rules panel, and only it, for a layout'
  },
  @{
    # TWO COPIES OF ONE NUMBER, and it cannot be one: `apps/admin` cannot import from
    # `components/games/`. The drift makes the hint a lie - an operator told four are shown
    # writes a fourth tip that is stored and never appears.
    Name = 'the admin hint and the card disagree about how many tips are drawn'
    File = $FIELDS
    From = 'export const ARENA_HIGHLIGHT_LIMIT = 4;'
    To   = 'export const ARENA_HIGHLIGHT_LIMIT = 6;'
    Test = 'agrees with the player app about how many tips'
  },
  @{
    # The same lie one field along: the hint promises four numbered steps while the card
    # draws three, so the operator's fourth instruction is stored and never seen.
    Name = 'the admin hint and the card disagree about how many steps are drawn'
    File = $FIELDS
    From = 'export const ARENA_STEP_LIMIT = 3;'
    To   = 'export const ARENA_STEP_LIMIT = 4;'
    Test = 'agrees with the player app about how many steps'
  },
  @{
    # The one thing an operator cannot discover: the strip numbers each LINE, so the
    # reference's three instructions appear only when somebody writes three lines.
    Name = 'the dialog stops saying that a line break makes a step'
    File = $DIALOG
    From = 'One line per step: the contest screen numbers them and shows the first ${ARENA_STEP_LIMIT}. '
    To   = ''
    Test = 'tells the operator that a line break is what makes a step'
  },
  @{
    # `CONTENT_LIMITS.highlights` is six and the card draws four, so the last two are stored
    # and drawn nowhere. The dialog is the one place an operator can act on that.
    Name = 'the dialog stops saying how many get drawn'
    File = $DIALOG
    From = 'The first{" "}
                  {ARENA_HIGHLIGHT_LIMIT} titles are shown, so write each title so it'
    To   = 'Write each title so it'
    Test = 'says so beside the field that offers more than that'
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

  try {
    $raw = & npx vitest run $Suite -t "$($probe.Test)" 2>&1
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
