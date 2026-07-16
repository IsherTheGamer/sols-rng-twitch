#!/usr/bin/env bash
set -euo pipefail

if [ ! -d ".git" ]; then
  echo "❌ Run this inside the repository."
  exit 1
fi

mapfile -t CANDIDATES < <(
  git ls-files |
    awk '
      index($0, "/") == 0 &&
      (
        $0 ~ /^PATCH_.*\.(js|cjs|mjs)$/ ||
        $0 ~ /^IMPORT_.*\.sh$/ ||
        $0 ~ /^APPLY_.*\.(js|cjs|mjs|sh)$/ ||
        $0 ~ /^HOTFIX_.*\.(js|cjs|mjs|sh)$/ ||
        $0 ~ /\.bak\.[0-9]+$/
      )
    '
)

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "✅ No tracked root patch/helper files found."
  exit 0
fi

echo "Root patch/helper files that are safe to remove after a successful build:"
printf '  %s\n' "${CANDIDATES[@]}"

if [ "${1:-}" != "--apply" ]; then
  echo ""
  echo "Preview only. To remove them from Git and GitHub, run:"
  echo "bash CLEAN_ROOT_PATCH_FILES.sh --apply"
  exit 0
fi

git rm -- "${CANDIDATES[@]}"

echo ""
echo "✅ Removed generated root patch/helper files from Git tracking."
echo "Run npm run build, then commit and push the cleanup."
