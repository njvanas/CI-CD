#!/usr/bin/env bash
# Turn on GitHub branch protection for this repo's default branch.
# That is the setting behind the banner:
#   "Your master branch isn't protected"
#
# A commit cannot enable this. Run it as a repository admin:
#
#   ./scripts/protect-default-branch.sh
#
# Optional: ./scripts/protect-default-branch.sh OWNER/REPO
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is required. See https://cli.github.com/" >&2
  exit 1
fi

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

DEFAULT_BRANCH="$(gh api "repos/${REPO}" --jq .default_branch)"
echo "Protecting ${REPO}@${DEFAULT_BRANCH} (no force-push, no deletion)"

# Pull-request and status-check requirements stay off so push-to-deploy still works.
# Force-pushes and deletion are blocked for everyone, including admins.
if ! gh api --method PUT "repos/${REPO}/branches/${DEFAULT_BRANCH}/protection" \
  --input - >/tmp/protect-default-branch.json <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "lock_branch": false
}
EOF
then
  echo "error: could not update branch protection (admin access required)." >&2
  echo "Sign in as the repository owner: gh auth login" >&2
  echo "Or use the GitHub UI: https://github.com/${REPO}/settings/branches" >&2
  cat /tmp/protect-default-branch.json >&2 || true
  exit 1
fi

PROTECTED="$(gh api "repos/${REPO}/branches/${DEFAULT_BRANCH}" --jq .protected)"
echo "Branch ${DEFAULT_BRANCH} protected=${PROTECTED}"
if [[ "$PROTECTED" != "true" ]]; then
  echo "error: GitHub still reports the branch as unprotected." >&2
  exit 1
fi

echo "Done. Refresh the repository page; the banner should be gone."
