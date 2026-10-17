# Probes for __tests__/admin/admin-employee-access.test.ts: each injects one defect,
# confirms the file really changed, runs the suite, reports the failure count, restores.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$suite = '__tests__/admin/admin-employee-access.test.ts'

$probes = @(
  @{ Name = 'login signs no iat'; File = 'apps/admin/app/api/auth/login/route.ts'; From = '      .setIssuedAt()'; To = '      ' },
  @{ Name = 'missing iat fails open'; File = 'apps/admin/lib/admin/session-token-time.ts'; From = 'Number.isFinite(iat) ? iat : 0'; To = 'Number.isFinite(iat) ? iat : Number.MAX_SAFE_INTEGER' },
  @{ Name = 'check-session drops password rule'; File = 'apps/admin/app/api/auth/check-session/route.ts'; From = 'wasIssuedBefore(payload.iat, admin.passwordChangedAt)'; To = 'false' },
  @{ Name = 'Full Admin without employees'; File = 'apps/admin/database/models/admin-role-template.model.ts'; From = 'allowedSections: [...ADMIN_SECTIONS],'; To = 'allowedSections: ADMIN_SECTIONS.filter((s) => s !== "employees"),' },
  @{ Name = 'sync ignores seeded record'; File = 'apps/admin/lib/admin/default-role-templates.ts'; From = 'const seeded = new Set(existing.seededSections ?? []);'; To = 'const seeded = new Set<string>();' },
  @{ Name = 'sync skips employees'; File = 'apps/admin/lib/admin/default-role-templates.ts'; From = '{ roleTemplateId: existing._id },'; To = '{ roleTemplateId: "none" },' },
  @{ Name = 'sync overwrites operator template'; File = 'apps/admin/lib/admin/default-role-templates.ts'; From = 'if (!existing.isDefault) continue;'; To = '' },
  @{ Name = 'catalogue drops a group entry'; File = 'apps/admin/lib/admin/admin-section-catalog.ts'; From = '"round-inspector",'; To = '' }
)

foreach ($p in $probes) {
  $path = Join-Path $root $p.File
  $orig = [System.IO.File]::ReadAllText($path, $utf8)
  if ([string]::IsNullOrEmpty($orig)) { Write-Host "EMPTY READ $($p.Name)"; continue }
  $idx = $orig.IndexOf($p.From)
  if ($idx -lt 0) { Write-Host "PROBE DID NOT APPLY: $($p.Name)"; continue }
  $mut = $orig.Substring(0, $idx) + $p.To + $orig.Substring($idx + $p.From.Length)
  [System.IO.File]::WriteAllText($path, $mut, $utf8)
  try {
    $out = (& npx.cmd vitest run $suite 2>&1 | Out-String) -replace '\s+', ' '
    $m = [regex]::Match($out, 'Tests\s+(\d+) failed')
    $failed = if ($m.Success) { $m.Groups[1].Value } else { '0' }
    Write-Host ("{0}: {1} failed" -f $p.Name, $failed)
  } finally {
    [System.IO.File]::WriteAllText($path, $orig, $utf8)
  }
  if ([System.IO.File]::ReadAllText($path, $utf8) -ne $orig) { Write-Host "RESTORE FAILED $($p.File)" }
}
