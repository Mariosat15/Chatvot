# Probes for mandatory phone at registration (format + duplicate + admin-only visibility).
# Run from repo root: powershell -NoProfile -File tools/probe-phone-registration.ps1

$ErrorActionPreference = "Continue"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = "__tests__/utils/phone-registration.test.ts"

function Read-Source {
  param([string]$Path)
  $full = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($full, $Utf8NoBom)
  if ([string]::IsNullOrEmpty($text)) {
    throw "ABORT: read '$Path' as empty. Refusing to write it back."
  }
  return $text
}

function Write-Source {
  param([string]$Path, [string]$Text)
  if ([string]::IsNullOrEmpty($Text)) {
    throw "ABORT: refusing to write empty content to '$Path'."
  }
  $full = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($full, $Text, $Utf8NoBom)
}

function To-Relaxed-Regex {
  param([string]$Literal)
  $escaped = [regex]::Escape($Literal)
  return ($escaped -replace '(\\r)?\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$Expect
  )

  Write-Host ""
  Write-Host "=== PROBE: $Name" -ForegroundColor Cyan

  $original = Read-Source -Path $File
  $pattern = To-Relaxed-Regex -Literal $Find
  $literalReplace = $Replace.Replace('$', '$$')
  $patched = [regex]::new($pattern).Replace($original, $literalReplace, 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY]" -ForegroundColor Magenta
    return
  }

  Write-Source -Path $File -Text $patched
  try {
    $out = & npx vitest run $Suite -t $Expect 2>&1 | Out-String
    $collapsed = ($out -replace '\s+', ' ')
    $failed = 0
    if ($collapsed -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }
    elseif ($collapsed -match '(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -eq 1) {
      Write-Host "  RED x1 on expected guard - OK" -ForegroundColor Green
    }
    elseif ($failed -eq 0) {
      Write-Host "  GREEN (guard not caught) - BAD" -ForegroundColor Red
      Write-Host $out
    }
    else {
      Write-Host "  RED x$failed (expected 1) - check blast radius" -ForegroundColor Yellow
      Write-Host $out
    }
  }
  finally {
    Write-Source -Path $File -Text $original
  }
}

Write-Host "Phone registration probes" -ForegroundColor Cyan

Invoke-Probe -Name "sign-up skips PhoneInputField" `
  -File "app/(auth)/sign-up/page.tsx" `
  -Find "<PhoneInputField" `
  -Replace "<XPhoneInputField" `
  -Expect "sign-up form requires phoneCountry"

Invoke-Probe -Name "auth stores raw national digits" `
  -File "lib/actions/auth.actions.ts" `
  -Find "phone: phoneParsed.e164," `
  -Replace "phone: phoneNational," `
  -Expect "auth action parses phone"

Invoke-Probe -Name "auth skips duplicate check" `
  -File "lib/actions/auth.actions.ts" `
  -Find "assertPhoneAvailable(phoneParsed.e164)" `
  -Replace "assertPhoneAvailable('__never__')" `
  -Expect "auth action parses phone"

Invoke-Probe -Name "auth creates account before phone check" `
  -File "lib/actions/auth.actions.ts" `
  -Find "const phoneCheck = await assertPhoneAvailable(phoneParsed.e164);" `
  -Replace "const responseEarly = await auth.api.signUpEmail({ body: { email, password, name: fullName } }); void responseEarly; const phoneCheck = await assertPhoneAvailable(phoneParsed.e164);" `
  -Expect "auth action parses phone"

Invoke-Probe -Name "profile skips uniqueness" `
  -File "app/api/user/profile/route.ts" `
  -Find "const availability = await assertPhoneAvailable(
          parsed.e164,
          session.user.id,
        );" `
  -Replace "const availability = { available: true } as const;" `
  -Expect "profile route re-validates phone"

Invoke-Probe -Name "admin edit skips uniqueness" `
  -File "apps/admin/app/api/users/edit/route.ts" `
  -Find "assertPhoneAvailable(parsed.e164, userId)" `
  -Replace "Promise.resolve({ available: true } as const)" `
  -Expect "admin edit route re-validates phone"

Invoke-Probe -Name "admin mirror drifts" `
  -File "apps/admin/lib/utils/phone.ts" `
  -Find "Stored form is always E.164" `
  -Replace "Stored form is always national" `
  -Expect "admin phone utility stays byte-identical"

Invoke-Probe -Name "gm view gains a phone field" `
  -File "lib/services/gamemaster/gm-referral-view.ts" `
  -Find "export interface GmReferralView {" `
  -Replace "export interface GmReferralView { phone: string | null;" `
  -Expect "Game Master referral view never exposes phone"

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
