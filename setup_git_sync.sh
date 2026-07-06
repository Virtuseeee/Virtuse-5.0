#!/bin/bash
# One-time setup to sync this folder with GitHub.
# Run it from Terminal: cd into this folder, then:
#   chmod +x setup_git_sync.sh && ./setup_git_sync.sh

set -e
REPO_URL="https://github.com/Virtuseeee/Virtuse-5.0.git"
cd "$(dirname "$0")"

echo "== Checking for git =="
if ! command -v git &> /dev/null; then
  echo "git not found — launching the Xcode Command Line Tools installer."
  echo "A dialog should appear. Complete the install, then re-run this script."
  xcode-select --install
  exit 1
fi
echo "git found: $(git --version)"

echo "== Setting up repository in $(pwd) =="
if [ ! -d .git ]; then
  git init
  git branch -m main
fi

if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "== Fetching from GitHub (you may be prompted to authenticate in your browser) =="
git fetch origin

REMOTE_BRANCH=""
if git show-ref --verify --quiet refs/remotes/origin/main; then
  REMOTE_BRANCH="main"
elif git show-ref --verify --quiet refs/remotes/origin/master; then
  REMOTE_BRANCH="master"
fi

if [ -n "$REMOTE_BRANCH" ]; then
  echo "== Found existing content on GitHub ($REMOTE_BRANCH) — merging into local folder =="
  git checkout -B main
  if ! git merge "origin/$REMOTE_BRANCH" --allow-unrelated-histories -m "Merge remote $REMOTE_BRANCH into local"; then
    echo ""
    echo "Merge conflicts found. Resolve them in this folder, then run:"
    echo "  git add ."
    echo "  git commit"
    echo "  git push -u origin main"
    exit 1
  fi
else
  echo "== Remote repo looks empty — this will become the first commit =="
fi

echo "== Staging and committing local files =="
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Sync Virtu AI folder"
else
  echo "Nothing new to commit."
fi

echo "== Pushing to GitHub =="
git push -u origin main

echo ""
echo "Done. This folder is now synced with $REPO_URL"
echo "To sync again later, just re-run this script (or use: git add -A && git commit -m \"update\" && git push)."
