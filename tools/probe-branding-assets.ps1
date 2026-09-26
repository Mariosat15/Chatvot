# Probes for the branding asset store - `__tests__/services/branding-assets.test.ts`.
#
# Same harness as probe-game-content.ps1; its lessons are already paid for and not re-derived
# here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write; refuse to
# write when the read came back empty; confirm the file actually changed; name the expected
# failing test and judge by the summary counts of that single filtered test.
#
# 1-2 tests red is the honest number for a one-line change. Where a mutation legitimately
# breaks more, the count is declared with the reason - an undeclared over-run is usually the
# harness having damaged the file rather than the guard doing its job.
#
# WHAT IS BEING DEFENDED. Every uploaded image used to be base64-encoded into one entry of a
# map on the single shared `WhiteLabel` document. That document reached MongoDB's 16MB ceiling
# on 8 September 2026, so no image on the platform could be stored - and the ceiling is
# reached by success rather than by a bug, which is why it arrived with no warning at all.
#
# Five of these probes are about the store; the rest are about the two things that make a
# storage change dangerous. A READ that knows only the new location silently loses every
# image uploaded in the platform's history to date, and a WRITE that still touches the shared
# document fails again on the next upload while looking completely correct.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/branding-assets.test.ts"
$results = @()

function Read-Outcome {
    param([string]$Name, [string]$Out, [int]$MaxRed = 2)

    if ($Out -match 'No test files found' -or $Out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($Out -match 'Tests\s+(\d+)\s+failed') {
        $red = [int]$Matches[1]
        if ($red -gt $MaxRed) {
            $outcome = "OVER LIMIT ($red failed, expected <= $MaxRed)"
            Write-Host "  $outcome" -ForegroundColor Magenta
        }
        else {
            $outcome = "RED ($red failed)"
            Write-Host "  $outcome" -ForegroundColor Green
        }
    }
    elseif ($Out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [int]$MaxRed = 2
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    # Escape the literal, then relax every newline: line endings are mixed across this
    # repository, so a literal multi-line pattern matches one file and silently misses the
    # next - which is indistinguishable from a test that does not work.
    $pattern = [regex]::Escape($From) -replace '\\r\\n|\\n', '\r?\n'
    if (-not [regex]::IsMatch($original, $pattern)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = [regex]::Replace($original, $pattern, { param($m) $To })
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    return Read-Outcome -Name $Name -Out $out -MaxRed $MaxRed
}

$SERVICE = "lib/services/branding-assets.service.ts"
$MODEL = "database/models/branding-asset.model.ts"
$MIGRATION = "tools/branding/migrate-branding-files-core.ts"
$WHITELABEL = "database/models/whitelabel.model.ts"
$ARTWORK = "apps/admin/lib/admin/game-artwork-storage.ts"

# ---------------------------------------------------------------------------------------
# 1. THE DEFECT ITSELF, restored. The write goes back into the shared settings document. It
#    still succeeds against a small test database, which is exactly why nobody saw this
#    coming: the store worked perfectly for every upload until the one that did not fit.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the write goes back into the shared WhiteLabel document" `
    -File $SERVICE `
    -From "  await connectToDatabase();`r`n  await BrandingAsset.findOneAndUpdate(" `
    -To "  await connectToDatabase();`r`n  const legacy = (await WhiteLabel.findOne().select(`"+brandingFiles`")) ?? new WhiteLabel();`r`n  if (!legacy.brandingFiles) legacy.brandingFiles = new Map();`r`n  legacy.brandingFiles.set(encodeBrandingFileKey(filename), { data: buffer.toString(`"base64`"), contentType, updatedAt: new Date() });`r`n  await legacy.save();`r`n  await BrandingAsset.findOneAndUpdate(" `
    -TestName "does not touch the settings document at all"

# ---------------------------------------------------------------------------------------
# 2. The per-file limit goes. The refusal then comes from the driver instead, as
#    `BSONObj size ... is invalid` - which is what the operator was shown, and it names
#    nothing they can act on.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the per-file size limit is removed" `
    -File $SERVICE `
    -From "  if (buffer.length > MAX_BRANDING_ASSET_BYTES) {" `
    -To "  if (false) {" `
    -TestName "refuses a file over the per-file limit"

# ---------------------------------------------------------------------------------------
# 3. THE ONE THAT WOULD LOSE EVERY EXISTING IMAGE. The reader stops consulting the legacy
#    map. Every test about the new store stays green, and every picture uploaded before
#    8 September 2026 becomes a missing image with no error raised anywhere.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the reader drops the legacy fallback" `
    -File $SERVICE `
    -From "  const settings = await WhiteLabel.findOne().select(`"+brandingFiles`");`r`n  const legacy = settings?.brandingFiles?.get(encodeBrandingFileKey(filename));" `
    -To "  const legacy: { data?: string; contentType?: string } | undefined = undefined;" `
    -TestName "still finds one left in the legacy map"

# ---------------------------------------------------------------------------------------
# 4. The reader consults the legacy map FIRST. A file re-uploaded since the change exists in
#    both stores and the map holds the OLD picture, so this serves an image the operator has
#    already replaced - and then writes it back to disk, so it stays replaced.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the reader prefers the stale legacy copy" `
    -File $SERVICE `
    -From "  const stored = await BrandingAsset.findOne({ filename }).lean();" `
    -To "  const early = await WhiteLabel.findOne().select(`"+brandingFiles`");`r`n  const earlyHit = early?.brandingFiles?.get(encodeBrandingFileKey(filename));`r`n  if (earlyHit?.data) return { data: Buffer.from(earlyHit.data, `"base64`"), contentType: earlyHit.contentType || `"image/png`" };`r`n  const stored = await BrandingAsset.findOne({ filename }).lean();" `
    -TestName "prefers the collection when both stores hold the same filename"

# ---------------------------------------------------------------------------------------
# 5. Delete stops clearing the legacy map. The asset route then restores a file the operator
#    has deleted - and restores it to disk, so it comes back permanently.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "delete leaves the legacy copy behind" `
    -File $SERVICE `
    -From "  if (settings?.brandingFiles?.has(key)) {" `
    -To "  if (false && settings?.brandingFiles?.has(key)) {" `
    -TestName "removes it from both stores"

# ---------------------------------------------------------------------------------------
# 6. The upsert stops being keyed on the filename, so replacing an image appends a second
#    document instead. Both are readable and the wrong one wins on the next read.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "storing the same filename twice appends rather than replaces" `
    -File $SERVICE `
    -From "  await BrandingAsset.findOneAndUpdate(`r`n    { filename }," `
    -To "  await BrandingAsset.findOneAndUpdate(`r`n    { filename, updatedAt: new Date() }," `
    -TestName "replaces rather than duplicates when the same filename is stored twice"

# ---------------------------------------------------------------------------------------
# 7. `bytes` records the base64 length instead of the decoded size, so every report of what
#    the store is holding is a third too high.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the recorded size is the base64 length, not the image's" `
    -File $SERVICE `
    -From "        bytes: buffer.length," `
    -To "        bytes: buffer.toString(`"base64`").length," `
    -TestName "stores the decoded size, not the base64 length"

# ---------------------------------------------------------------------------------------
# 8. The collection name is left to Mongoose to pluralise. One app then writes
#    `brandingassets` while the other reads `branding_asset`, with every test green in both.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the collection name is guessed rather than declared" `
    -File $MODEL `
    -From "  { collection: `"branding_asset`" }," `
    -To "" `
    -TestName "declare the same model, so both apps read one collection" `
    -MaxRed 2

# ---------------------------------------------------------------------------------------
# 9. `select: false` comes off the legacy map. 67 files call `WhiteLabel.findOne()`, so this
#    puts a base64 copy of every image ever uploaded back on the path of every settings read.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the legacy map goes back on the hot path of every settings read" `
    -File $WHITELABEL `
    -From "      select: false,`r`n      type: Map," `
    -To "      type: Map," `
    -TestName "an ordinary settings read does not fetch the map"

# ---------------------------------------------------------------------------------------
# 10. The migration overwrites a collection entry with the map's stale copy. It reads as
#     correct - the migration's job is to copy - and it restores old artwork over new.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the migration overwrites a newer image with the map's older one" `
    -File $MIGRATION `
    -From "    const existing = await assets.findOne({ filename });`r`n    if (existing) {" `
    -To "    const existing = null;`r`n    if (existing) {" `
    -TestName "never overwrites a newer collection entry with the map's stale copy"

# ---------------------------------------------------------------------------------------
# 11. Report-only starts writing. A dry run that copies is not a dry run, and this migration
#     has only ever been run in that mode.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the report-only mode writes anyway" `
    -File $MIGRATION `
    -From "    if (!options.apply) {`r`n      outcome.files.push({ filename, bytes, outcome: `"copied`" });`r`n      outcome.clearable += 1;`r`n      continue;`r`n    }" `
    -To "" `
    -TestName "changes nothing at all without --apply"

# ---------------------------------------------------------------------------------------
# 12. The migration clears an entry that holds no data. It is the only operation in there
#     that would destroy information rather than move it.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the migration deletes an entry it could not copy" `
    -File $MIGRATION `
    -From "    if (!entry?.data) {`r`n      outcome.files.push({ filename, bytes: 0, outcome: `"empty`" });`r`n      continue;`r`n    }" `
    -To "    if (!entry?.data) {`r`n      outcome.files.push({ filename, bytes: 0, outcome: `"empty`" });`r`n      if (options.apply) await clearEntry(db, settings._id, key);`r`n      continue;`r`n    }" `
    -TestName "leaves an entry with no data, and reports it"

# ---------------------------------------------------------------------------------------
# 13. A WRITER reaches past the service and back into the map by hand. Two tests red is the
#     honest number: the file both mentions the field and no longer calls the service, and
#     those are two separate claims about it.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the game artwork writer reaches into the map itself" `
    -File $ARTWORK `
    -From "    await putBrandingAsset(filename, buffer, contentType);" `
    -To "    const s = await WhiteLabel.findOne().select(`"+brandingFiles`");`r`n    s?.brandingFiles?.set(filename, { data: buffer.toString(`"base64`"), contentType, updatedAt: new Date() });`r`n    await s?.save();" `
    -TestName "game-artwork-storage.ts" `
    -MaxRed 2

# ---------------------------------------------------------------------------------------
# 14. THE MIRROR. `check:mirrors` compares MODELS, so it has no opinion about the service -
#     and the admin app is the only writer while the player app is a reader, so a drift here
#     is precisely the case where images save and never appear.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the two copies of the service drift apart" `
    -File "apps/admin/lib/services/branding-assets.service.ts" `
    -From "export const MAX_BRANDING_ASSET_BYTES = 8 * 1024 * 1024;" `
    -To "export const MAX_BRANDING_ASSET_BYTES = 2 * 1024 * 1024;" `
    -TestName "are byte-identical"

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("  {0,-34} {1}" -f $_.Outcome, $_.Name) }
Write-Host ""
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) probe(s) did not go red - investigate before believing any guard." -ForegroundColor Red
}
