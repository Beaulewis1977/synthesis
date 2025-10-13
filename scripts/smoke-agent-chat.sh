#!/usr/bin/env bash

# Lightweight smoke test for /api/agent/chat.
# Usage: scripts/smoke-agent-chat.sh [collection_id] [message]

set -euo pipefail

COLLECTION_ID="${1:-00000000-0000-0000-0000-000000000001}"
MESSAGE="${2:-What is the purpose of the MCP server?}"
CHAT_URL="${AGENT_CHAT_URL:-http://localhost:3333/api/agent/chat}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed." >&2
  exit 1
fi

payload="$(jq -n --arg message "${MESSAGE}" --arg collection_id "${COLLECTION_ID}" \
  '{message: $message, collection_id: $collection_id}')"

response="$(curl -sS -w '\n%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "${payload}" \
  "${CHAT_URL}")"

status="${response##*$'\n'}"
body="${response%$'\n'*}"

case "${status}" in
  200)
    echo "Agent chat smoke test passed."
    exit 0
    ;;
  429)
    echo "Agent chat responded with 429 rate limit; treating as warning." >&2
    echo "${body}"
    exit 0
    ;;
  *)
    echo "Agent chat smoke test failed with status ${status}." >&2
    echo "${body}"
    exit 1
    ;;
esac
