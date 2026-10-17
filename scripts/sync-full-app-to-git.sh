#!/bin/bash
# ============================================
# CHARTVOLT - FULL APP SYNC TO GIT
# ============================================
#
# Run this ON THE SERVER to commit the entire
# application (code + defaults + images) to git.
#
# Use this when you've made changes on the server
# (code fixes, new features, config changes) and
# want to sync everything back to git.
#
# For syncing ONLY defaults/images, use:
#   ./scripts/sync-defaults-to-git.sh
#
# Usage:
#   chmod +x scripts/sync-full-app-to-git.sh
#   ./scripts/sync-full-app-to-git.sh
#   ./scripts/sync-full-app-to-git.sh --message "Fixed bug X"
#   ./scripts/sync-full-app-to-git.sh --dry-run
#
# ============================================

set -e

APP_DIR="/var/www/chartvolt"
BRANCH="main"
DRY_RUN=false
CUSTOM_MESSAGE=""

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
echo "║        CHARTVOLT - FULL APP SYNC TO GIT                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

if [ ! -d ".git" ]; then
  echo "❌ ERROR: Not a git repository at $APP_DIR"
  exit 1
fi

echo "📂 Working directory: $(pwd)"
echo "🌿 Branch: $BRANCH"
echo ""

# Ensure correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "⚠️  Switching from '$CURRENT_BRANCH' to '$BRANCH'..."
  git checkout "$BRANCH"
fi

# Pull latest
echo "📥 Pulling latest..."
git pull origin "$BRANCH" --no-edit 2>/dev/null || echo "⚠️  Pull had issues. Continuing..."

# ============================================
# Stage everything (respecting .gitignore)
# ============================================
echo ""
echo "📦 Staging all tracked and new files..."
echo "   (Respecting .gitignore - runtime uploads, logs, node_modules excluded)"
echo ""

# Add all changes (new, modified, deleted) respecting .gitignore
git add -A

# Show what will be committed
echo "📊 Changes to commit:"
CHANGES=$(git diff --cached --stat 2>/dev/null)

if [ -z "$CHANGES" ]; then
  echo "  ℹ️  No changes to commit. Server is in sync with git!"
  exit 0
fi

echo "$CHANGES"
echo ""

FILES_CHANGED=$(git diff --cached --numstat | wc -l)
echo "  Total files: $FILES_CHANGED"
echo ""

# Show breakdown by type
echo "  📁 Breakdown:"
echo "    Code files: $(git diff --cached --numstat -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' | wc -l)"
echo "    Config files: $(git diff --cached --numstat -- '*.json' '*.config.*' '*.yaml' '*.yml' | wc -l)"
echo "    Images: $(git diff --cached --numstat -- '*.png' '*.jpg' '*.jpeg' '*.webp' '*.svg' '*.gif' | wc -l)"
echo "    Styles: $(git diff --cached --numstat -- '*.css' '*.scss' | wc -l)"
echo "    Docs: $(git diff --cached --numstat -- '*.md' '*.doc' '*.txt' | wc -l)"
echo "    Other: $(git diff --cached --numstat -- ':!*.ts' ':!*.tsx' ':!*.js' ':!*.jsx' ':!*.mjs' ':!*.json' ':!*.config.*' ':!*.yaml' ':!*.yml' ':!*.png' ':!*.jpg' ':!*.jpeg' ':!*.webp' ':!*.svg' ':!*.gif' ':!*.css' ':!*.scss' ':!*.md' ':!*.doc' ':!*.txt' | wc -l)"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN - Would commit $FILES_CHANGED files."
  git reset HEAD . > /dev/null 2>&1
  exit 0
fi

# Commit
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
if [ -n "$CUSTOM_MESSAGE" ]; then
  COMMIT_MSG="$CUSTOM_MESSAGE"
else
  COMMIT_MSG="sync: full app sync from server ($FILES_CHANGED files)

Synced at $TIMESTAMP from production.
Includes code, defaults, assets, and configurations."
fi

echo "💾 Committing..."
git commit -m "$COMMIT_MSG"

echo ""
echo "🚀 Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        FULL SYNC COMPLETE!                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Files: $FILES_CHANGED | Branch: $BRANCH | Time: $TIMESTAMP"
echo ""
echo "  👉 Run 'git pull' locally to get the updates."
echo ""
