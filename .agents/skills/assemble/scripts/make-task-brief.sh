#!/usr/bin/env bash
set -euo pipefail

# make-task-brief.sh
# Usage: make-task-brief.sh [--issue <number>] [--out brief.json] [--paths "path1 path2"]
# Generates a Task Brief JSON suitable for Assemble sub-agents.

OUT=task-brief.json
ISSUE_NUMBER=""
EXTRA_PATHS=""
MAX_SNIPPET_SIZE=8192 # bytes

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      ISSUE_NUMBER="$2"; shift 2;;
    --out)
      OUT="$2"; shift 2;;
    --paths)
      EXTRA_PATHS="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

# helpers
jq_exists() { command -v jq >/dev/null 2>&1; }
rg_exists() { command -v rg >/dev/null 2>&1; }

# gather task description
if [[ -n "$ISSUE_NUMBER" ]]; then
  if command -v gh >/dev/null 2>&1; then
    ISSUE_JSON=$(gh issue view "$ISSUE_NUMBER" --json number,title,body,labels --jq '.')
    TITLE=$(echo "$ISSUE_JSON" | jq -r '.title // ""')
    BODY=$(echo "$ISSUE_JSON" | jq -r '.body // ""')
    LABELS=$(echo "$ISSUE_JSON" | jq -c '.labels // []')
    TASK_SHORT="Issue #$ISSUE_NUMBER — $TITLE"
  else
    echo "gh CLI not found; cannot fetch issue $ISSUE_NUMBER" >&2
    exit 1
  fi
else
  TASK_SHORT="Custom task"
  TITLE=""
  BODY=""
  LABELS="[]"
fi

# find relevant specs (simple keyword search from title + body)
KEYWORDS=$(printf "%s" "$TITLE $BODY" | tr ' ' '\n' | rg -o "[A-Za-z0-9_-]{3,}" 2>/dev/null | tr '\n' ' ' | awk '{print tolower($0)}' || true)
SPEC_PATHS=()
if [[ -n "$KEYWORDS" ]] && rg_exists; then
  for kw in $KEYWORDS; do
    while IFS= read -r p; do
      SPEC_PATHS+=("$p")
    done < <(rg -n --glob "specs/**" -S --hidden --no-ignore "$kw" || true)
  done
fi
# dedupe
if (( ${#SPEC_PATHS[@]} > 0 )); then
  IFS=$'\n' read -r -d '' -a SPEC_PATHS < <(printf "%s\n" "${SPEC_PATHS[@]}" | awk '!x[$0]++' && printf '\0')
fi

# Determine changed files relative to origin/main
CHANGED_FILES=$(git diff --name-only origin/main...HEAD || true)

# include EXTRA_PATHS
if [[ -n "$EXTRA_PATHS" ]]; then
  for p in $EXTRA_PATHS; do
    CHANGED_FILES="$CHANGED_FILES\n$p"
  done
fi

# Build files array
FILES_JSON="[]"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  [[ ! -f "$path" ]] && continue
  size=$(wc -c < "$path" | tr -d ' ')
  excerpt=""
  diff_text=""
  if (( size < MAX_SNIPPET_SIZE )); then
    excerpt=$(python3 - <<PY
import json,sys
print(json.dumps(open("$path","rb").read().decode('utf-8',errors='replace')))
PY
)
  else
    excerpt=$(python3 - <<PY
import json,sys
lines=open("$path","r",errors='replace').read().splitlines()
head='\n'.join(lines[:200])
print(json.dumps(head))
PY
)
    diff_text=$(git --no-pager diff --no-color origin/main...HEAD -- "$path" 2>/dev/null | sed 's/"/\\"/g' || true)
  fi
  # append to FILES_JSON
  FILES_JSON=$(jq -n --arg p "$path" --arg s "$size" --arg e "$excerpt" --arg d "$diff_text" '{path:$p,size:$s|tonumber,excerpt:$e,diff:$d}' )
  # Use an accumulating array stored in a temp file to avoid complex jq merges
  TMPFILE=$(mktemp)
  echo "$FILES_JSON" > "$TMPFILE"
  if [[ -f "${OUT}.tmpfiles" ]]; then
    jq -s '.[0] + [.[1]]' "${OUT}.tmpfiles" "$TMPFILE" > "${OUT}.tmpfiles.new" && mv "${OUT}.tmpfiles.new" "${OUT}.tmpfiles"
  else
    jq -s '.[1] | [.]' "$TMPFILE" > "${OUT}.tmpfiles"
  fi
  rm -f "$TMPFILE"
done < <(printf "%s\n" "$CHANGED_FILES")

if [[ -f "${OUT}.tmpfiles" ]]; then
  FILES_AGG=$(cat "${OUT}.tmpfiles")
  rm -f "${OUT}.tmpfiles"
else
  FILES_AGG="[]"
fi

RECENT_COMMITS=$(git log --oneline -5 --pretty=format:'%h %s' || true)
BRANCH=$(git rev-parse --abbrev-ref HEAD || true)
NODE_VERSION=$(node -v 2>/dev/null || "unknown")
PNPM_VERSION=$(pnpm -v 2>/dev/null || "unknown")

# sanitize to remove secrets (simple regex removal for env-looking lines)
sanitize() {
  echo "$1" | sed -E 's/(?:API|SECRET|TOKEN|KEY)[:=][^\n\r ]*/REDACTED/gI'
}

# produce brief
jq -n \
  --arg task "$TASK_SHORT" \
  --arg title "$TITLE" \
  --arg body "$(sanitize "$BODY")" \
  --argjson labels "$LABELS" \
  --argjson specs "$(jq -n '$ARGS.positional' --args ${SPEC_PATHS[@]:-})" \
  --argjson files "$FILES_AGG" \
  --arg commits "$RECENT_COMMITS" \
  --arg branch "$BRANCH" \
  --arg node "$NODE_VERSION" \
  --arg pnpm "$PNPM_VERSION" \
  '{task:$task,title:$title,body:$body,labels:$labels,specs:$specs,files:$files,recent_commits:$commits,branch:$branch,environment:{node:$node,pnpm:$pnpm}}' > "$OUT"

echo "Task brief written to $OUT"
exit 0
