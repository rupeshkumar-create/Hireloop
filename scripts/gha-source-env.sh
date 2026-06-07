#!/usr/bin/env bash
# Load env for GitHub Actions.
#
# Priority:
#   1. GitHub Actions secrets (injected by the workflow step env: block) — always wins
#   2. Vercel env pull — only fills NON-sensitive vars that are still empty
#
# Sensitive vars are NEVER read from the pulled .env file (Vercel omits or truncates them).
set -euo pipefail

ENV_FILE=".env.vercel.local"
require_apify="${REQUIRE_APIFY:-false}"

is_set() {
  local v="${1:-}"
  [ -n "$v" ] && [ "$v" != '""' ]
}

# Snapshot secrets GitHub injected before any Vercel pull.
PRESERVED_FIREBASE="${FIREBASE_SERVICE_ACCOUNT_KEY:-}"
PRESERVED_OPENROUTER="${OPENROUTER_API_KEY:-}"
PRESERVED_FIRESTORE_ID="${FIRESTORE_DATABASE_ID:-}"
PRESERVED_APIFY="${APIFY_API_TOKEN:-}"

needs_vercel=false
if ! is_set "${FIRESTORE_DATABASE_ID:-}" || ! is_set "${APIFY_API_TOKEN:-}"; then
  needs_vercel=true
fi

if $needs_vercel && is_set "${VERCEL_TOKEN:-}" && is_set "${VERCEL_ORG_ID:-}" && is_set "${VERCEL_PROJECT_ID:-}"; then
  echo "Pulling supplemental env from Vercel (non-sensitive only)..."
  export VERCEL_ORG_ID VERCEL_PROJECT_ID
  if npx --yes vercel@latest env pull "$ENV_FILE" --environment=production --yes --token="$VERCEL_TOKEN"; then
    echo "Vercel env pull succeeded."
  else
    echo "Vercel env pull failed — continuing with GitHub secrets only." >&2
  fi
elif ! is_set "${VERCEL_TOKEN:-}"; then
  echo "VERCEL_TOKEN not set — using GitHub Actions secrets only."
fi

# Parse .env safely — never override existing values or sensitive keys.
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    line="${line#export }"
    key="${line%%=*}"
    key="${key// /}"
    [[ -z "$key" ]] && continue

    case "$key" in
      FIREBASE_SERVICE_ACCOUNT_KEY|OPENROUTER_API_KEY) continue ;;
    esac
    is_set "${!key:-}" && continue

    val="${line#*=}"
    val="${val#\"}"; val="${val%\"}"
    export "$key=$val"
  done < "$ENV_FILE"
fi

# Restore anything GitHub had before Vercel pull.
if ! is_set "${FIREBASE_SERVICE_ACCOUNT_KEY:-}" && is_set "$PRESERVED_FIREBASE"; then
  export FIREBASE_SERVICE_ACCOUNT_KEY="$PRESERVED_FIREBASE"
fi
if ! is_set "${OPENROUTER_API_KEY:-}" && is_set "$PRESERVED_OPENROUTER"; then
  export OPENROUTER_API_KEY="$PRESERVED_OPENROUTER"
fi
if ! is_set "${FIRESTORE_DATABASE_ID:-}" && is_set "$PRESERVED_FIRESTORE_ID"; then
  export FIRESTORE_DATABASE_ID="$PRESERVED_FIRESTORE_ID"
fi
if ! is_set "${APIFY_API_TOKEN:-}" && is_set "$PRESERVED_APIFY"; then
  export APIFY_API_TOKEN="$PRESERVED_APIFY"
fi

export_to_github_env() {
  local name="$1"
  local value="${!name:-}"
  is_set "$value" || return 0
  {
    echo "${name}<<EOF"
    printf '%s\n' "$value"
    echo "EOF"
  } >> "${GITHUB_ENV:-/dev/null}"
}

if [ -n "${GITHUB_ENV:-}" ]; then
  export_to_github_env FIREBASE_SERVICE_ACCOUNT_KEY
  export_to_github_env OPENROUTER_API_KEY
  export_to_github_env FIRESTORE_DATABASE_ID
  export_to_github_env APIFY_API_TOKEN
fi

missing=()
is_set "${FIREBASE_SERVICE_ACCOUNT_KEY:-}" || missing+=("FIREBASE_SERVICE_ACCOUNT_KEY")
is_set "${OPENROUTER_API_KEY:-}" || missing+=("OPENROUTER_API_KEY")
if [ "$require_apify" = "true" ]; then
  is_set "${APIFY_API_TOKEN:-}" || missing+=("APIFY_API_TOKEN")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing required GitHub Actions secrets: ${missing[*]}" >&2
  echo "" >&2
  echo "Add these in GitHub → Settings → Secrets and variables → Actions:" >&2
  echo "  FIREBASE_SERVICE_ACCOUNT_KEY  (full Firebase service account JSON, one line)" >&2
  echo "  OPENROUTER_API_KEY" >&2
  if [ "$require_apify" = "true" ]; then
    echo "  APIFY_API_TOKEN" >&2
  fi
  echo "  FIRESTORE_DATABASE_ID         (optional if using named Firestore DB)" >&2
  echo "" >&2
  echo "Optional (pulls non-sensitive vars only):" >&2
  echo "  VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID" >&2
  exit 1
fi

if ! node -e "JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)" 2>/dev/null; then
  echo "FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON." >&2
  echo "Paste the entire service account JSON as a single-line secret in GitHub Actions." >&2
  exit 1
fi

echo "Env ready (Firebase + OpenRouter present)."
