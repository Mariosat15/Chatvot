# Probe harness for task document 9 - the game category vocabulary.
#
# Each probe injects one defect, runs ONE named test, and expects it red. A probe that stays
# green has four known causes and they need four different responses: a weak test, a wrong
# claim, an unreachable guard, or a mutation that changes no observable. Naming the expected
# test is what tells them apart - a bare "did the suite go red" reports a passing probe when
# the test it was aimed at does not exist.
#
# THE HARNESS RULES, every one of them learned by getting it wrong:
#   - -LiteralPath on the READ as well as the write. A path containing [brackets] is a
#     PowerShell wildcard, so Get-Content returns $null and Set-Content writes the file back
#     empty. It reports every probe red, on the expected test, for entirely the wrong reason.
#   - Refuse to write when the read came back empty.
#   - ASCII anchors only. This file is UTF-8 with no BOM and PowerShell 5.1 decodes it with
#     the system codepage, so an em-dash or an emoji in a pattern arrives as mojibake and
#     reports PROBE DID NOT APPLY.
#   - Confirm the file actually changed before believing any outcome.
#   - No regex metacharacters in an expected test name. vitest treats -t as a regex, so a `$`
#     is an end-of-line anchor and the named test silently never runs.
#   - Collapse whitespace in captured output before matching. Out-String wraps at the console
#     width, so a long test name arrives split across two lines.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Suite = '__tests__/admin/game-categories.test.ts'
$script:pass = 0
$script:fail = 0

function Relaxed([string]$literal) {
  [regex]::Escape($literal) -replace '\\r\\n|\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    # A SECOND edit in the same probe, for the case where two guards cover each other. Removing
    # either alone leaves the other holding the property, so the probe reports green and reads
    # exactly like a guard that does nothing. Same situation as R42's two game gates - the
    # difference is that here both can be reached from one file, so it is probeable rather than
    # something to record as unprobed.
    [string]$AlsoFrom,
    [string]$AlsoTo,
    [string]$ExpectRed
  )

  $path = Join-Path $root $File
  $original = [IO.File]::ReadAllText($path)
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "HARNESS BROKEN  $Name - read returned nothing for $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  $pattern = Relaxed $From
  if (-not [regex]::IsMatch($original, $pattern)) {
    Write-Host "DID NOT APPLY   $Name - pattern not found in $File" -ForegroundColor Magenta
    $script:fail++
    return
  }

  # A MatchEvaluator, not a replacement string: `$` and `\` in the replacement are otherwise
  # substitution syntax, and several of these probes inject template literals.
  $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "DID NOT APPLY   $Name - replacement changed nothing" -ForegroundColor Magenta
    $script:fail++
    return
  }

  if ($AlsoFrom) {
    $second = Relaxed $AlsoFrom
    if (-not [regex]::IsMatch($mutated, $second)) {
      Write-Host "DID NOT APPLY   $Name - second pattern not found" -ForegroundColor Magenta
      $script:fail++
      return
    }
    $mutated = [regex]::Replace($mutated, $second, { param($m) $AlsoTo }, 1)
  }

  try {
    [IO.File]::WriteAllText($path, $mutated, (New-Object Text.UTF8Encoding $false))

    $out = & cmd.exe /c "npx vitest run $Suite -t `"$ExpectRed`" --reporter=basic 2>&1" | Out-String
    $flat = ($out -replace '\s+', ' ')

    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $count = [int]$Matches[1]
      if ($count -eq 1) {
        Write-Host "RED             $Name" -ForegroundColor Green
        $script:pass++
      } else {
        Write-Host "RED (x$count)      $Name - more than the expected test broke" -ForegroundColor Yellow
        $script:pass++
      }
    } elseif (
      $flat -match 'No test files found' -or
      $flat -match 'Tests\s+no tests' -or
      # THE ONE THAT COST A FALSE PASS. A -t pattern matching nothing is not an error to
      # vitest: it reports a passing run over zero tests, so a probe aimed at a misspelt test
      # name reads as "the guard is not doing its job". Zero passed and zero failed is the
      # tell, and it is indistinguishable from a real green without this branch.
      $flat -match 'Tests\s+0\s+passed' -or
      $flat -notmatch 'Tests\s+\d+\s+passed'
    ) {
      Write-Host "NO TEST RAN     $Name - '$ExpectRed' matched nothing" -ForegroundColor Magenta
      $script:fail++
    } else {
      Write-Host "GREEN           $Name - the guard is not doing its job" -ForegroundColor Red
      $script:fail++
    }
  } finally {
    [IO.File]::WriteAllText($path, $original, (New-Object Text.UTF8Encoding $false))
  }
}

$VOCAB = 'lib/services/games/game-categories.ts'
$CONTENT = 'apps/admin/lib/admin/game-content-fields.ts'
$PRESENT = 'lib/services/games/game-presentation.service.ts'
$AI = 'apps/admin/lib/admin/ai-contest-vocabulary.ts'
$OPTIONS = 'apps/admin/lib/services/game-providers/provider-contest.service.ts'

Write-Host "`n=== the vocabulary ===" -ForegroundColor Cyan

# 1. A genre task 9 names goes missing. The picker silently stops offering it and every title
#    already filed under it becomes "unrecognised" on every screen.
Invoke-Probe -Name '1  a named genre dropped from the vocabulary' -File $VOCAB `
  -From '  { slug: "trivia", label: "Trivia" },' -To '' `
  -ExpectRed 'carries every genre task 9 names'

# 2. The two genres the live and mock catalogues actually declare. Losing `puzzle` means both
#    real titles render as unrecognised the day this ships, which reads as a broken vocabulary.
Invoke-Probe -Name '2  puzzle dropped, so both live titles go unrecognised' -File $VOCAB `
  -From '  { slug: "puzzle", label: "Puzzle" },' -To '' `
  -ExpectRed 'carries the genres the live and mock catalogues already declare'

# 3. A vocabulary entry that does not survive its own normaliser. Picking it from the dropdown
#    would store something else, and the stored value is a grouping key for ever.
Invoke-Probe -Name '3  a vocabulary slug that is not itself normalised' -File $VOCAB `
  -From '  { slug: "other", label: "Other" },' -To '  { slug: "Other Games", label: "Other" },' `
  -ExpectRed 'every slug is already normalised'

# 4. Two entries with one slug. The second is unreachable through the Map and the dropdown
#    shows the same genre twice.
Invoke-Probe -Name '4  a duplicate slug' -File $VOCAB `
  -From '  { slug: "board", label: "Board" },' -To '  { slug: "card", label: "Board" },' `
  -ExpectRed 'has no duplicate slugs'

Write-Host "`n=== resolve: display versus key ===" -ForegroundColor Cyan

# 5. THE SILENT REMAP. Falling back to a known-looking genre rewrites a provider's own
#    statement about their game and hides a real grouping key.
Invoke-Probe -Name '5  an unrecognised genre remapped to Other' -File $VOCAB `
  -From '  return { slug, label: humaniseSlug(slug), isKnown: false };' `
  -To '  return { slug: "other", label: "Other", isKnown: true };' `
  -ExpectRed 'SHOWS an unrecognised slug rather than dropping'

# 6. THE PLACEHOLDER. A badge reading "Uncategorised" on a player's screen is a genre nobody
#    chose, and it makes an undescribed title indistinguishable from a described one.
Invoke-Probe -Name '6  an absent genre invents a placeholder' -File $VOCAB `
  -From '  if (typeof stored !== "string") return undefined;' `
  -To '  if (typeof stored !== "string") return { slug: "other", label: "Uncategorised", isKnown: false };' `
  -ExpectRed 'answers undefined for absent, empty and whitespace'

# 7. A stored empty string is what a pre-$unset document holds, and every consumer treats a
#    present value as something to render.
Invoke-Probe -Name '7  an empty stored genre reads as present' -File $VOCAB `
  -From '  if (slug === "") return undefined;' -To '  if (slug === "!!!never") return undefined;' `
  -ExpectRed 'answers undefined for absent, empty and whitespace'

# 8. The Map becomes an object, so a stored "__proto__" returns something truthy that survives
#    the `if (known)` test. Fourth instance of that trap in this codebase.
Invoke-Probe -Name '8  Map swapped for an object lookup' -File $VOCAB `
  -From 'const BY_SLUG: ReadonlyMap<string, GameCategory> = new Map(
  GAME_CATEGORIES.map((entry) => [entry.slug, entry]),
);' `
  -To 'const BY_SLUG = {
  get(slug: string): GameCategory | undefined {
    return (Object.fromEntries(GAME_CATEGORIES.map((e) => [e.slug, e])) as Record<string, GameCategory>)[slug];
  },
  has(slug: string): boolean {
    return Boolean(this.get(slug));
  },
};' `
  -ExpectRed 'cannot be steered onto the prototype chain'

Write-Host "`n=== normalise: one genre, one key ===" -ForegroundColor Cyan

# 9. Single-character replacement instead of a run, so "sci - fi" yields sci---fi - a different
#    key from sci-fi, so two operators typing one genre file titles in two buckets.
Invoke-Probe -Name '9  separators not collapsed into one hyphen' -File $VOCAB `
  -From '.replace(/[^a-z0-9]+/g, "-")' -To '.replace(/[^a-z0-9]/g, "-")' `
  -ExpectRed 'collapses a RUN of separators'

# 10. No lower-casing, so "Racing" and "racing" are two genres that each look complete.
Invoke-Probe -Name '10 case not normalised' -File $VOCAB `
  -From '    .toLowerCase()' -To '' `
  -ExpectRed 'lower-cases and hyphenates'

# 11. THE TRUNCATION TRAP. Cutting at 40 can land exactly on a hyphen, and a slug ending in a
#     hyphen is a different grouping key from the same slug without one.
Invoke-Probe -Name '11 trailing hyphen after truncation' -File $VOCAB `
  -From '  const clipped = slug.slice(0, CATEGORY_SLUG_MAX_LENGTH).replace(/-+$/g, "");' `
  -To '  const clipped = slug.slice(0, CATEGORY_SLUG_MAX_LENGTH);' `
  -ExpectRed 're-strips after truncating'

# 12. An empty slug returned instead of null. A stored "" reads as ABSENT to the badge and
#     PRESENT to a `has` check - a value that is simultaneously there and not there.
#
#     TWO GUARDS, ONE PROBE. Aimed at either check alone this came back green, twice, and it
#     is neither a weak test nor a wrong claim: the two `=== ""` checks COVER EACH OTHER, so
#     the survivor answers null for every empty input. R42's shape, probeable here only
#     because both live in one file - hence the second injection.
Invoke-Probe -Name '12 an empty slug returned instead of null' -File $VOCAB `
  -From '  if (slug === "") return null;' -To '  if (slug === "!!!never") return null;' `
  -AlsoFrom '  return clipped === "" ? null : clipped;' -AlsoTo '  return clipped;' `
  -ExpectRed 'answers null when nothing is left'

# 13. Truncation removed, so the normaliser can return a value the server-side length check
#     then refuses - a form that reports success and fails with a 400.
Invoke-Probe -Name '13 no truncation, so the slug can exceed the stored limit' -File $VOCAB `
  -From '.slice(0, CATEGORY_SLUG_MAX_LENGTH)' -To '.slice(0)' `
  -ExpectRed 'truncates a long single word to the limit exactly'

Write-Host "`n=== the validator ===" -ForegroundColor Cyan

# 14. THE CENTRAL DEFECT THIS SLICE FIXES: free text stored as typed, so the grouping key is
#     whatever somebody happened to press.
Invoke-Probe -Name '14 stored as typed instead of normalised' -File $CONTENT `
  -From '    content.category = typed === "" ? "" : (normaliseCategorySlug(typed) ?? "");' `
  -To '    content.category = typed;' `
  -ExpectRed 'NORMALISES what it is sent'

# 15. Refusing an unrecognised genre. Tidier-looking and wrong: the dialog submits every field
#     in one request, so it blocks an edit that has nothing to do with the genre.
Invoke-Probe -Name '15 an unrecognised genre refused, blocking an unrelated edit' -File $CONTENT `
  -From '    content.category = typed === "" ? "" : (normaliseCategorySlug(typed) ?? "");' `
  -To '    if (typed !== "" && !isKnownCategorySlug(typed)) {
      return { ok: false, error: `"${typed}" is not a known genre.` };
    }
    content.category = typed;' `
  -ExpectRed 'ACCEPTS an unrecognised genre rather than refusing'

# 16. The limit becomes a second literal, so the normaliser and the validator can disagree.
Invoke-Probe -Name '16 the length limit duplicated as a literal' -File $CONTENT `
  -From '  category: CATEGORY_SLUG_MAX_LENGTH,' -To '  category: 24,' `
  -ExpectRed 'takes its length limit FROM the vocabulary module'

Write-Host "`n=== the consumers ===" -ForegroundColor Cyan

# 17. The raw slug reaches the player's arena badge, so a custom genre reads SCI-FI.
Invoke-Probe -Name '17 the arena badge gets the raw slug' -File $PRESENT `
  -From '    category: resolveGameCategory(title.category)?.label,' `
  -To '    category: title.category || undefined,' `
  -ExpectRed 'game-presentation.service.ts resolves it and does not pass it through'

# 18. The resolver is imported AND the raw value is rendered anyway. This is the mutation the
#     positive assertion alone is green against - which is why the negative half exists.
Invoke-Probe -Name '18 resolver called, raw value rendered anyway' -File $PRESENT `
  -From '    category: resolveGameCategory(title.category)?.label,' `
  -To '    category: resolveGameCategory(title.category) ? title.category : undefined,' `
  -ExpectRed 'game-presentation.service.ts resolves it and does not pass it through'

# 19. The AI prompt is handed our database instead of a description of the game.
Invoke-Probe -Name '19 the AI prompt gets the raw slug' -File $AI `
  -From '  const category = resolveGameCategory(title.category);
  return category ? `${title.displayName} (${category.label})` : title.displayName;' `
  -To '  const category = title.category?.trim();
  return category ? `${title.displayName} (${category})` : title.displayName;' `
  -ExpectRed 'the AI vocabulary composes the prompt from the label'

# 20. The wizard picker is handed the raw slug.
Invoke-Probe -Name '20 the wizard picker gets the raw slug' -File $OPTIONS `
  -From '        category: resolveGameCategory(title.category)?.label,' `
  -To '        category: title.category,' `
  -ExpectRed 'listContestableTitles hands the wizard the resolved label'

Write-Host "`n=== the model and the mirror ===" -ForegroundColor Cyan

# 21. THE ENUM. A missing enum value rejects the WHOLE write, so a provider shipping a title in
#     a genre we have not thought of costs us that entire catalogue row on a scheduled sync.
Invoke-Probe -Name '21 the vocabulary declared as a Mongoose enum' -File 'database/models/games/provider-game.model.ts' `
  -From '    category: { type: String },' `
  -To '    category: { type: String, enum: ["racing", "puzzle", "other"] },' `
  -ExpectRed 'is NOT declared as a Mongoose enum on either model copy'

# 22. The admin copy of the model, which is the one that runs when an operator presses Sync.
Invoke-Probe -Name '22 the enum on the admin copy only' -File 'apps/admin/database/models/games/provider-game.model.ts' `
  -From '    category: { type: String },' `
  -To '    category: { type: String, enum: ["racing", "puzzle", "other"] },' `
  -ExpectRed 'is NOT declared as a Mongoose enum on either model copy'

# 23. The two copies of the vocabulary drift, so one app's known slug is the other's unknown
#     one. check:mirrors compares models and has no opinion about this file.
Invoke-Probe -Name '23 the mirror drifts by one genre' -File 'apps/admin/lib/services/games/game-categories.ts' `
  -From '  { slug: "reflex", label: "Reflex" },' -To '  { slug: "reflexes", label: "Reflex" },' `
  -ExpectRed 'both copies of the vocabulary are byte-identical'

Write-Host ""
Write-Host "red: $($script:pass)   green or broken: $($script:fail)" -ForegroundColor Cyan
if ($script:fail -gt 0) { exit 1 }
