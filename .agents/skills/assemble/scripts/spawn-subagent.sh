#!/usr/bin/env bash
set -euo pipefail

# spawn-subagent.sh
# Usage: spawn-subagent.sh --model <model-id> --persona <dev|critic> --brief <task-brief.json> [--allowed-tools "read bash edit write"]

MODEL=${MODEL:-"google/gemini-3-flash"}
PERSONA=${PERSONA:-"dev"}
BRIEF=${BRIEF:-task-brief.json}
ALLOWED_TOOLS=${ALLOWED_TOOLS:-"read bash edit write"}
MAX_RUNTIME=${MAX_RUNTIME:-"1800"} # seconds

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) MODEL="$2"; shift 2;;
    --persona) PERSONA="$2"; shift 2;;
    --brief) BRIEF="$2"; shift 2;;
    --allowed-tools) ALLOWED_TOOLS="$2"; shift 2;;
    --max-runtime) MAX_RUNTIME="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ ! -f "$BRIEF" ]]; then
  echo "Brief file $BRIEF not found" >&2
  exit 1
fi

# Build payload
PAYLOAD=$(jq -n --arg model "$MODEL" --arg persona "$PERSONA" --argfile brief "$BRIEF" --arg tools "$ALLOWED_TOOLS" --arg runtime "$MAX_RUNTIME" '{model:$model,persona:$persona,brief:$brief,allowed_tools:($tools|split(" ")),max_runtime:$runtime|tonumber}')

# If `pi` CLI exists and supports agent spawn, call it. Otherwise print the payload and suggest manual invocation.
if command -v pi >/dev/null 2>&1; then
  echo "Invoking pi agent spawn with model=$MODEL persona=$PERSONA brief=$BRIEF"
  # The exact pi CLI flags vary by installation; try a generic form and fallback to echo
  if pi --help 2>&1 | rg -i spawn >/dev/null 2>&1; then
    pi spawn --model "$MODEL" --persona "$PERSONA" --input-file "$BRIEF" --max-runtime "$MAX_RUNTIME"
  else
    echo "Your pi CLI doesn't expose a standard 'spawn' subcommand. Writing payload to .agents/skills/assemble/last-payload.json"
    echo "$PAYLOAD" > .agents/skills/assemble/last-payload.json
    echo "Please invoke your agent runner with the payload file .agents/skills/assemble/last-payload.json and the desired model ID."
    echo
    echo "Payload:"; echo "$PAYLOAD" | jq '.'
  fi
else
  echo "pi CLI not found. Saving payload to .agents/skills/assemble/last-payload.json"
  echo "$PAYLOAD" > .agents/skills/assemble/last-payload.json
  echo "Run your agent runner with that payload. Payload preview:"; echo "$PAYLOAD" | jq '.'
fi

exit 0
