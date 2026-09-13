#!/bin/bash
# ============================================
# CHARTVOLT - SYNC DEFAULTS TO GIT
# ============================================
#
# Run this ON THE SERVER to commit all default
# data (marketplace items, badges, milestones,
# images) to git and push to the repository.
#
# After running this, do `git pull` locally to
# get the updated defaults.
#
# Usage:
#   chmod +x scripts/sync-defaults-to-git.sh
#   ./scripts/sync-defaults-to-git.sh
#   ./scripts/sync-defaults-to-git.sh --message "Updated marketplace images"
#   ./scripts/sync-defaults-to-git.sh --dry-run
#
# What it syncs:
#   - data/defaults/*.json (badges, milestones, XP)
#   - apps/admin/lib/data/*.json (marketplace defaults)
#   - public/assets/marketplace/* (marketplace images)
#   - public/assets/images/* (admin images)
#   - public/assets/avatars/* (avatar assets)
#   - .gitignore (if updated)
#
# ============================================

set -e

# Configuration
APP_DIR="/var/www/chartvolt"
BRANCH="main"
DRY_RUN=false
CUSTOM_MESSAGE=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      ;;
    --message)
      shift
      CUSTOM_MESSAGE="$1"
      ;;
    --message=*)
      CUSTOM_MESSAGE="${arg#*=}"
      ;;
  esac
  shift 2>/dev/null || true
done

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        CHARTVOLT - SYNC DEFAULTS TO GIT                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# Verify we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ ERROR: Not a git repository at $APP_DIR"
  exit 1
fi

echo "📂 Working directory: $(pwd)"
echo "🌿 Branch: $BRANCH"
echo ""

# ============================================
# STEP 1: Ensure we're on the right branch
# ============================================
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "⚠️  Currently on branch '$CURRENT_BRANCH', switching to '$BRANCH'..."
  git checkout "$BRANCH"
fi

# ============================================
# STEP 2: Pull latest to avoid conflicts
# ============================================
echo "📥 Pulling latest from remote..."
git pull origin "$BRANCH" --no-edit 2>/dev/null || {
  echo "⚠️  Pull had issues (might be first push). Continuing..."
}

# ============================================
# STEP 3: Stage default data files
# ============================================
echo ""
echo "📦 Staging default data files..."

# Badge, milestone, XP defaults
if [ -d "data/defaults" ]; then
  git add data/defaults/*.json 2>/dev/null && echo "  ✅ data/defaults/*.json" || echo "  ⏭️  No JSON files in data/defaults/"
fi

# Marketplace defaults
if [ -f "apps/admin/lib/data/marketplace-defaults.json" ]; then
  git add apps/admin/lib/data/marketplace-defaults.json && echo "  ✅ apps/admin/lib/data/marketplace-defaults.json"
fi

# ============================================
# STEP 4: Stage asset images
# ============================================
echo ""
echo "🖼️  Staging asset images..."

# Marketplace images (the committed defaults)
if [ -d "public/assets/marketplace" ]; then
  MARKETPLACE_COUNT=$(find public/assets/marketplace -type f 2>/dev/null | wc -l)
  git add public/assets/marketplace/ 2>/dev/null && echo "  ✅ public/assets/marketplace/ ($MARKETPLACE_COUNT files)" || echo "  ⏭️  No marketplace assets"
fi

# Admin images
if [ -d "public/assets/images" ]; then
  IMAGES_COUNT=$(find public/assets/images -type f 2>/dev/null | wc -l)
  git add public/assets/images/ 2>/dev/null && echo "  ✅ public/assets/images/ ($IMAGES_COUNT files)" || echo "  ⏭️  No admin images"
fi

# Avatar assets
if [ -d "public/assets/avatars" ]; then
  AVATAR_COUNT=$(find public/assets/avatars -type f 2>/dev/null | wc -l)
  git add public/assets/avatars/ 2>/dev/null && echo "  ✅ public/assets/avatars/ ($AVATAR_COUNT files)" || echo "  ⏭️  No avatar assets"
fi

# ============================================
# STEP 5: Stage seed service files (templates)
# ============================================
echo ""
echo "📝 Staging seed service files..."

# Marketplace seed service (contains hardcoded templates)
git add lib/services/marketplace-seed.service.ts 2>/dev/null && echo "  ✅ lib/services/marketplace-seed.service.ts" || true
git add apps/admin/lib/services/marketplace-seed.service.ts 2>/dev/null && echo "  ✅ apps/admin/lib/services/marketplace-seed.service.ts" || true

# Badge seed
git add lib/services/badge-config-seed.service.ts 2>/dev/null && echo "  ✅ lib/services/badge-config-seed.service.ts" || true
git add apps/admin/lib/services/badge-config-seed.service.ts 2>/dev/null && echo "  ✅ apps/admin/lib/services/badge-config-seed.service.ts" || true

# Badge constants
git add lib/constants/badges.ts 2>/dev/null && echo "  ✅ lib/constants/badges.ts" || true

# Milestone blueprint
git add apps/admin/lib/constants/milestone-blueprint.ts 2>/dev/null && echo "  ✅ apps/admin/lib/constants/milestone-blueprint.ts" || true

# White-label defaults service
git add apps/admin/lib/services/whitelabel-defaults.service.ts 2>/dev/null && echo "  ✅ apps/admin/lib/services/whitelabel-defaults.service.ts" || true
git add lib/services/whitelabel-defaults-reader.ts 2>/dev/null && echo "  ✅ lib/services/whitelabel-defaults-reader.ts" || true

# .gitignore
git add .gitignore 2>/dev/null && echo "  ✅ .gitignore" || true

# ============================================
# STEP 6: Check what changed
# ============================================
echo ""
echo "📊 Changes staged:"
CHANGES=$(git diff --cached --stat 2>/dev/null)

if [ -z "$CHANGES" ]; then
  echo "  ℹ️  No changes to commit. Everything is up to date!"
  exit 0
fi

echo "$CHANGES"
echo ""

# Count changes
FILES_CHANGED=$(git diff --cached --numstat | wc -l)
echo "  Total files changed: $FILES_CHANGED"
echo ""

# ============================================
# STEP 7: Commit and push
# ============================================
if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN - Would commit $FILES_CHANGED files. No changes made."
  git reset HEAD . > /dev/null 2>&1
  exit 0
fi

# Build commit message
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
if [ -n "$CUSTOM_MESSAGE" ]; then
  COMMIT_MSG="$CUSTOM_MESSAGE"
else
  COMMIT_MSG="sync: update platform defaults ($FILES_CHANGED files)

Synced at $TIMESTAMP from production server.
Includes: marketplace items, badges, milestones, images, seed configs."
fi

echo "💾 Committing..."
git commit -m "$COMMIT_MSG"

echo ""
echo "🚀 Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        SYNC COMPLETE!                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Files synced: $FILES_CHANGED"
echo "  Branch: $BRANCH"
echo "  Time: $TIMESTAMP"
echo ""
echo "  👉 Now run 'git pull' on your local machine to get the updates."
echo ""
