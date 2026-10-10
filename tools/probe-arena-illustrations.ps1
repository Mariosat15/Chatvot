# Probes for the guards behind the owner's 11 September 2026 instruction about the arena band:
# the three panels the same height, a picture beside the text, that picture editable in admin,
# and a hand cursor over a control.
#
# EVERY DEFECT PROBED HERE RENDERS PERFECTLY AND REPORTS SUCCESS. There is no wrong number
# anywhere in this slice - a short panel, a missing emblem, an unread field and an arrow cursor
# all raise nothing and log nothing - so the guards are structural and the probes are the only
# evidence any of them is doing work.
#
# Harness rules, every one of which has produced a false result on this codebase before:
#   * -LiteralPath on the READ as well as the write, or a path containing `[id]` matches
#     nothing while Set-Content happily truncates the file.
#   * UTF-8 without a BOM both ways.
#   * Refuse to write empty content.
#   * Name the expected failing test, run it alone with -t, and treat "no test matched" as a
#     BROKEN PROBE rather than as a pass - a probe aimed at the wrong test is indistinguishable
#     from a guard that does not work.
#   * The -t filter is a REGEX, so the fragments below avoid brackets and pipes.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/arena-illustrations.test.ts'

$LAYOUT = 'components/games/arena/GameArenaLayout.tsx'
$CARDS = 'components/neon/Cards.tsx'
$RULES = 'components/games/GameRulesPanel.tsx'
$HIGHLIGHTS = 'components/games/arena/ArenaHighlights.tsx'
$PRESENTATION = 'lib/services/games/game-presentation.service.ts'
$DIALOG = 'apps/admin/components/admin/games/GameContentDialog.tsx'
$FIELDS = 'apps/admin/lib/admin/game-content-fields.ts'
$ROUTE = 'apps/admin/app/api/games/providers/[providerKey]/games/artwork/route.ts'
$BUTTON = 'components/ui/button.tsx'
$NEON_BUTTONS = 'components/neon/Buttons.tsx'
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
  # ---- The panels are the same height ------------------------------------------------------
  @{
    # THE OBVIOUS WRONG FIX, restored verbatim. `h-full` on the wrapper is a no-op, because a
    # flex item already stretches - the wrappers were level while the owner was looking at
    # panels that were not. A guard asserting "the band mentions h-full" is green on this.
    #
    # RE-AIMED 11 September 2026, when the band became a fixed-height strip. The three probes
    # in this block named the old markup verbatim and would have reported DID NOT APPLY -
    # which reads like a broken harness rather than a moved target, and fails in the quiet
    # direction. The CLAIMS are unchanged; only the class strings moved.
    Name = 'the height is set on the wrapper instead of on the panel inside it'
    File = $LAYOUT
    From = 'className="min-w-[260px] flex-[1.15_1_0] empty:hidden [&>*]:h-full">
          {rules}'
    To   = 'className="min-w-[260px] flex-[1.15_1_0] empty:hidden h-full">
          {rules}'
    Test = 'reaches through each wrapper to the panel inside it'
  },
  @{
    # One slot only. A bare match is satisfied by the other two while the third panel is the
    # short one - and it would be whichever panel happened to have the least text.
    Name = 'one slot stops stretching its panel'
    File = $LAYOUT
    From = '<div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">
          {activity}
        </div>'
    To   = '<div className="min-w-[260px] flex-[1_1_0] empty:hidden">
          {activity}
        </div>'
    Test = 'reaches through each wrapper to the panel inside it'
  },
  @{
    # The band was built, reverted and rebuilt, and this is the mutation that caused the
    # revert: a hidden GRID item leaves its track behind, so `empty:hidden` under a grid is a
    # hole rather than a shorter row. It is also the owner's own suggested CSS, which is why
    # the deviation is argued for in the test rather than just asserted.
    Name = 'the band is a grid again, so an absent panel leaves a hole'
    File = $LAYOUT
    From = 'className="mt-4 flex flex-wrap items-stretch gap-2.5 sm:h-24"'
    To   = 'className="mt-4 grid items-stretch gap-2.5 sm:h-24 lg:grid-cols-3"'
    Test = 'still lets a panel with nothing in it leave the row'
  },

  # ---- The picture, and the emblem that stands in for it -----------------------------------
  @{
    # THE DEFECT THE COMPONENT EXISTS TO PREVENT. Rendering only the upload is the natural
    # implementation and it is wrong for every title in the catalogue, because none carries
    # one - so the band is illustrated on nothing and looks broken on everything.
    Name = 'the illustration renders the upload and nothing else'
    File = $CARDS
    From = '  if (src) {'
    To   = '  if (true) {'
    Test = 'draws the emblem when the operator has uploaded nothing'
  },
  @{
    # The alt text is the one player-facing string on the band that the arena's own agnostic
    # guard cannot see, because this component lives in the kit.
    Name = 'somebody helpfully captions the emblem'
    File = $CARDS
    From = '          <Icon className="h-[45%] w-[45%]" strokeWidth={1.75} />'
    To   = '          <Icon className="h-[45%] w-[45%]" strokeWidth={1.75} />
          <span className="text-[9px] uppercase">Board</span>'
    Test = 'writes no words of its own under the emblem'
  },
  @{
    # A condition that reads as careful and delivers nothing: the arena passes `column`, so
    # gating on `wide` leaves the picture off the only screen it was asked for.
    Name = 'the rules picture is gated to a layout the arena never passes'
    File = $RULES
    From = '            <div className="mt-4">
              <NeonIllustration'
    To   = '            <div className="mt-4">
              {layout === "wide" && <NeonIllustration'
    Test = 'is not hidden behind a layout the arena never asks for'
  },
  @{
    # Both props are optional strings, so crossing them typechecks and puts the emblem where
    # the rules picture should be.
    Name = 'the play page never hands the emblem over'
    File = $PLAY_PAGE
    From = '            imageUrl={presentation.highlightsImageUrl}
'
    To   = ''
    Test = 'is drawn on both panels, from the field the operator set'
  },
  @{
    Name = 'the highlights panel ignores the field it was given'
    File = $HIGHLIGHTS
    From = '            src={imageUrl}'
    To   = '            src={undefined}'
    Test = 'is drawn on both panels, from the field the operator set'
  },

  # ---- The field reaches the screen --------------------------------------------------------
  @{
    # An explicitly-typed lean generic is where a field that does not exist looks real: the
    # compiler checks the generic, not the schema. Dropping the projection is silent.
    Name = 'the projection stops selecting one of the two images'
    File = $PRESENTATION
    From = 'bannerUrl howToPlayImageUrl highlightsImageUrl highlights'
    To   = 'bannerUrl highlightsImageUrl highlights'
    Test = 'carries both new fields end to end'
  },
  @{
    # Omitting a saved field from the callback leaves the parent row holding the old value, so
    # reopening the dialog shows the picture the operator just replaced.
    Name = 'the dialog saves an image and hands back the old one'
    File = $DIALOG
    From = '        howToPlayImageUrl: draft.howToPlayImageUrl,
'
    To   = ''
    Test = 'offers both as their own slots in the content dialog'
  },
  @{
    # A plain-http address draws nothing, with no error anywhere - the browser blocks it as
    # mixed content. The loop is what stops the newest image field getting a weaker check.
    Name = 'one image field drops out of the URL clause'
    File = $FIELDS
    From = '    "howToPlayImageUrl",
    "highlightsImageUrl",
'
    To   = ''
    Test = 'validates both by the same clause as every other image address'
  },
  @{
    # The slot reaches the stored filename, so an unchecked one is caller-supplied text in a
    # path. `in` and object indexing both walk the prototype chain.
    Name = 'the slot list becomes an object, so __proto__ passes'
    File = 'apps/admin/lib/admin/game-artwork-slots.ts'
    From = '  return typeof value === "string" && ARTWORK_SLOTS.has(value as ArtworkSlot);'
    To   = '  return Boolean(({ logo: 1, banner: 1, "how-to-play": 1, highlight: 1 } as Record<string, unknown>)[value as string]);'
    Test = 'refuses a slot the upload route does not know'
  },
  @{
    # Written twice, a form offering a slot the route has not heard of fails with a 400 that
    # reads to an operator like a permissions problem.
    Name = 'the route keeps its own copy of the slot list'
    File = $ROUTE
    From = '    if (!isArtworkSlot(slot)) {'
    To   = '    if (slot !== "logo" && slot !== "banner") {'
    Test = 'shares one list between the form and the route'
  },

  # ---- The hand cursor ---------------------------------------------------------------------
  @{
    # The owner's report. Tailwind v4's preflight dropped it and `globals.css` had been putting
    # it back a component at a time, which is why it kept reappearing.
    Name = 'the shared button loses the pointer cursor again'
    File = $BUTTON
    From = '"inline-flex cursor-pointer items-center'
    To   = '"inline-flex items-center'
    Test = 'is set on the primitive, not on one component class at a time'
  },
  @{
    # The kit's buttons do not use the primitive, so a fix applied only there leaves every
    # control on both lobbies and the arena with an arrow.
    Name = 'the neon control loses the pointer cursor'
    File = $NEON_BUTTONS
    From = 'inline-flex w-full cursor-pointer items-center'
    To   = 'inline-flex w-full items-center'
    Test = 'is set on the neon control too, without overriding the disabled cursor'
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
