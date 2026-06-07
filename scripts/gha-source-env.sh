#!/usr/bin/env bash
# Load env for GitHub Actions from Vercel (primary) or GitHub secrets (fallback).
set -euo pipefail

ENV_FILE=".env.vercel.local"

if [ -n "${VERCEL_TOKEN:-}" ] && [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
  echo "Pulling production env from Vercel..."
  npm install --global vercel@latest
  export VERCEL_ORG_ID VERCEL_PROJECT_ID
  if ! vercel env pull "$ENV_FILE" --environment=production --yes --token="$VERCEL_TOKEN"; then
    echo "Vercel env pull failed — falling back to GitHub Actions secrets if set." >&2
  fi
else
  echo "VERCEL_TOKEN not set in GitHub — using GitHub Actions secrets only."
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export_to_github_env() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    return 0
  fi
  {
    echo "${name}<<EOF"
    echo "$value"
    echo "EOF"
  } >> "$GITHUB_ENV"
}

for var in FIREBASE_SERVICE_ACCOUNT_KEY OPENROUTER_API_KEY FIRESTORE_DATABASE_ID APIFY_API_TOKEN; do
  export_to_github_env "$var"
done

missing=()
for var in FIREBASE_SERVICE_ACCOUNT_KEY OPENROUTER_API_KEY; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing required env: ${missing[*]}" >&2
  echo "" >&2
  echo "Add these 3 GitHub Actions secrets (one-time setup):" >&2
  echo "  VERCEL_TOKEN — create at https://vercel.com/account/tokens" >&2
  echo "  VERCEL_ORG_ID — Vercel project → Settings → General" >&2
  echo "  VERCEL_PROJECT_ID — same page" >&2
  echo "" >&2
  echo "Or duplicate FIREBASE_SERVICE_ACCOUNT_KEY + OPENROUTER_API_KEY into GitHub secrets." >&2
  exit 1
fi

echo "Env ready (Firebase + OpenRouter present)."
