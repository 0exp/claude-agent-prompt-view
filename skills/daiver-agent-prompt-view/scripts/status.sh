#!/bin/sh
# Health check of the agent-prompt-view mod: install state, versions, installed script, statusLine wiring.
REPO="${AGENT_PROMPT_VIEW_REPO:-$HOME/Projects/claude-agent-prompt-view}"
TARGET="$HOME/.claude/agent-prompt-view/statusline.sh"
SETTINGS="$HOME/.claude/settings.json"

echo "== plugin"
claude plugin list 2>/dev/null | grep -A4 'agent-prompt-view@' || echo "not installed"

echo "== repo ($REPO)"
if [ -d "$REPO" ]; then
  echo "manifest version: $(jq -r .version "$REPO/.claude-plugin/plugin.json")"
  git -C "$REPO" status --short 2>/dev/null | sed 's/^/  /'
else
  echo "missing"
fi

echo "== installed script ($TARGET)"
if [ -f "$TARGET" ]; then
  echo "updated: $(stat -f '%Sm' "$TARGET")"
  if [ -f "$REPO/statusline/prompt-view.sh" ]; then
    cmp -s "$TARGET" "$REPO/statusline/prompt-view.sh" && echo "same as the repo" || echo "differs from the repo: reload plugins or start a session"
  fi
else
  echo "missing: written on the next session start with the plugin loaded"
fi

echo "== statusLine"
if jq -e '.statusLine.command | contains(".claude/agent-prompt-view/statusline.sh")' "$SETTINGS" >/dev/null 2>&1; then
  echo "wired, refreshInterval: $(jq -r '.statusLine.refreshInterval // "default"' "$SETTINGS")"
else
  echo "not wired: statusLine.command does not run the installed script"
fi

echo "== sample render"
[ -f "$TARGET" ] && printf '{"model":{"display_name":"Model"},"cwd":"%s"}' "$REPO" | sh "$TARGET" | sed $'s/\e\\[[0-9;]*m//g'
