# ============================================
# CHARTVOLT - PULL DEFAULTS FROM SERVER
# ============================================
#
# Run this on your LOCAL Windows machine to
# download all default data and images directly
# from the production server via SCP.
#
# Prerequisites:
#   - SSH access to server (ssh root@148.230.124.57)
#   - SSH key configured (or will prompt for password)
#
# Usage:
#   .\scripts\pull-server-defaults.ps1
#   .\scripts\pull-server-defaults.ps1 -DryRun
#   .\scripts\pull-server-defaults.ps1 -Server "root@your-server-ip"
#   .\scripts\pull-server-defaults.ps1 -ServerPath "/var/www/chartvolt"
#
# ============================================

param(
    [string]$Server = "root@148.230.124.57",
    [string]$ServerPath = "/var/www/chartvolt",
    [switch]$DryRun,
    [switch]$SkipGit
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CHARTVOLT - PULL DEFAULTS FROM SERVER" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Get the project root (parent of scripts/)
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path "$ProjectRoot\package.json")) {
    $ProjectRoot = Get-Location
}

Write-Host "  Local project: $ProjectRoot" -ForegroundColor Gray
Write-Host "  Server: $Server" -ForegroundColor Gray
Write-Host "  Server path: $ServerPath" -ForegroundColor Gray
if ($DryRun) { Write-Host "  MODE: DRY RUN" -ForegroundColor Yellow }
Write-Host ""

# ============================================
# Define what to sync
# ============================================
$SyncItems = @(
    # Default data JSON files
    @{ Remote = "data/defaults/"; Local = "data\defaults\"; Type = "dir"; Desc = "Badge, Milestone, XP defaults" },
    
    # Marketplace defaults JSON
    @{ Remote = "apps/admin/lib/data/marketplace-defaults.json"; Local = "apps\admin\lib\data\marketplace-defaults.json"; Type = "file"; Desc = "Marketplace item templates" },
    
    # Asset images
    @{ Remote = "public/assets/marketplace/"; Local = "public\assets\marketplace\"; Type = "dir"; Desc = "Marketplace images" },
    @{ Remote = "public/assets/images/"; Local = "public\assets\images\"; Type = "dir"; Desc = "Admin images" },
    @{ Remote = "public/assets/avatars/"; Local = "public\assets\avatars\"; Type = "dir"; Desc = "Avatar assets" },
    
    # Seed service files
    @{ Remote = "lib/services/marketplace-seed.service.ts"; Local = "lib\services\marketplace-seed.service.ts"; Type = "file"; Desc = "Marketplace seed service" },
    @{ Remote = "apps/admin/lib/services/marketplace-seed.service.ts"; Local = "apps\admin\lib\services\marketplace-seed.service.ts"; Type = "file"; Desc = "Admin marketplace seed" },
    @{ Remote = "lib/services/badge-config-seed.service.ts"; Local = "lib\services\badge-config-seed.service.ts"; Type = "file"; Desc = "Badge seed service" },
    @{ Remote = "apps/admin/lib/services/badge-config-seed.service.ts"; Local = "apps\admin\lib\services\badge-config-seed.service.ts"; Type = "file"; Desc = "Admin badge seed" },
    @{ Remote = "lib/constants/badges.ts"; Local = "lib\constants\badges.ts"; Type = "file"; Desc = "Badge constants" },
    @{ Remote = "apps/admin/lib/constants/milestone-blueprint.ts"; Local = "apps\admin\lib\constants\milestone-blueprint.ts"; Type = "file"; Desc = "Milestone blueprint" },
    @{ Remote = "apps/admin/lib/services/whitelabel-defaults.service.ts"; Local = "apps\admin\lib\services\whitelabel-defaults.service.ts"; Type = "file"; Desc = "WL defaults service" },
    @{ Remote = "lib/services/whitelabel-defaults-reader.ts"; Local = "lib\services\whitelabel-defaults-reader.ts"; Type = "file"; Desc = "WL defaults reader" }
)

# ============================================
# Pull each item
# ============================================
$SuccessCount = 0
$FailCount = 0
$SkipCount = 0

foreach ($item in $SyncItems) {
    $remotePath = "$($ServerPath)/$($item.Remote)"
    $localPath = Join-Path $ProjectRoot $item.Local
    
    Write-Host "  Syncing: $($item.Desc)" -ForegroundColor White
    Write-Host "    Remote: $remotePath" -ForegroundColor DarkGray
    Write-Host "    Local:  $localPath" -ForegroundColor DarkGray
    
    if ($DryRun) {
        Write-Host "    [DRY RUN] Would download" -ForegroundColor Yellow
        $SkipCount++
        continue
    }
    
    # Ensure local directory exists
    $localDir = if ($item.Type -eq "dir") { $localPath } else { Split-Path -Parent $localPath }
    if (-not (Test-Path $localDir)) {
        New-Item -ItemType Directory -Path $localDir -Force | Out-Null
    }
    
    try {
        if ($item.Type -eq "dir") {
            # Use SCP recursive for directories
            $scpResult = scp -r "${Server}:${remotePath}" (Split-Path -Parent $localPath) 2>&1
        } else {
            # Single file
            $scpResult = scp "${Server}:${remotePath}" "$localPath" 2>&1
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    OK" -ForegroundColor Green
            $SuccessCount++
        } else {
            Write-Host "    SKIP (not found on server)" -ForegroundColor Yellow
            $SkipCount++
        }
    } catch {
        Write-Host "    FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $FailCount++
    }
}

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SYNC COMPLETE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Success: $SuccessCount" -ForegroundColor Green
Write-Host "  Skipped: $SkipCount" -ForegroundColor Yellow
Write-Host "  Failed:  $FailCount" -ForegroundColor $(if ($FailCount -gt 0) {"Red"} else {"Gray"})
Write-Host ""

# ============================================
# Git operations (optional)
# ============================================
if (-not $SkipGit -and -not $DryRun -and $SuccessCount -gt 0) {
    Write-Host "  Checking git status..." -ForegroundColor Gray
    
    Push-Location $ProjectRoot
    
    $gitStatus = git status --porcelain 2>&1
    $changedFiles = ($gitStatus | Measure-Object).Count
    
    if ($changedFiles -gt 0) {
        Write-Host "  $changedFiles files changed. Stage and commit? (y/n)" -ForegroundColor Yellow
        $response = Read-Host
        
        if ($response -eq "y" -or $response -eq "Y") {
            git add data/defaults/
            git add apps/admin/lib/data/marketplace-defaults.json
            git add public/assets/marketplace/
            git add public/assets/images/
            git add public/assets/avatars/
            git add lib/services/marketplace-seed.service.ts
            git add apps/admin/lib/services/marketplace-seed.service.ts
            git add lib/services/badge-config-seed.service.ts
            git add apps/admin/lib/services/badge-config-seed.service.ts
            git add lib/constants/badges.ts
            git add apps/admin/lib/constants/milestone-blueprint.ts
            git add apps/admin/lib/services/whitelabel-defaults.service.ts
            git add lib/services/whitelabel-defaults-reader.ts
            
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "sync: pull platform defaults from server ($timestamp)"
            
            Write-Host ""
            Write-Host "  Committed! Push to remote? (y/n)" -ForegroundColor Yellow
            $pushResponse = Read-Host
            if ($pushResponse -eq "y" -or $pushResponse -eq "Y") {
                git push origin main
                Write-Host "  Pushed to origin/main!" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  No changes detected. Everything is in sync!" -ForegroundColor Green
    }
    
    Pop-Location
}

Write-Host ""
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""
