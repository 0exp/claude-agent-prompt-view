---
name: daiver-agent-prompt-view
description: Manage the agent-prompt-view Claude Code mod (the five-line status line under the prompt - model/session/stime, agent-count line, modes, ctx/lmt/rst/pch bars, git state). Use when the user asks to check, enable, disable, update, change, debug, release, publish or uninstall the agent-prompt-view mod/plugin, its status line script, its look or its statusLine wiring.
---

# agent-prompt-view mod

Ships the user's status line as a script and keeps a stable copy of it:

```
Opus 5.5 -> [demo] (sid:419e75ee) <stime:1h23m>
⚙ main:thinking (1m13s) │ agents:0 (sub:0 sh:0 mon:0) │ …     ← agent-count mod, when present
(effort:high) (thinkmode:thinking) (outstyle:Proactive) (fastmode:false)
ctx ███░░░░░░░ 37% | lmt ████░░░░░░ 43% | rst ██████░░░░ 1h56m | pch ████████░░ 85%
 (08d3788a) main [+#?] | ~/Projects/demo
```

## Where things are

| What | Path |
| --- | --- |
| Source repo (also the marketplace) | `~/Projects/claude-agent-prompt-view/` (dev checkout of `github.com/0exp/claude-agent-prompt-view`; the status script reads `$AGENT_PROMPT_VIEW_REPO` when it lives elsewhere) |
| Status line script (the source of truth) | `statusline/prompt-view.sh` in the repo |
| Hooks module | `hooks/register.ts`: on `session.start` copies the script to the stable path when it differs |
| Installed copy (what the status line runs) | `~/.claude/agent-prompt-view/statusline.sh` |
| Status-line wiring | `statusLine.command` in `~/.claude/settings.json` = `sh "$HOME/.claude/agent-prompt-view/statusline.sh"`, `refreshInterval: 1` |
| Installed as | `agent-prompt-view@agent-prompt-view`, user scope; for development a `directory` marketplace pointing at the repo, for users the GitHub source |
| This skill | `skills/daiver-agent-prompt-view/` in the repo (ships with the plugin) |

## Invariants

- Line 2 is the agent-count mod's file `~/.claude/agent-count/<session_id>`, printed only when it exists: keep that fragment right after the first line; the two mods stay independent.
- The script is POSIX `sh` + `jq` + `git`, and must print something even with a minimal input (`{"model":{"display_name":"X"},"cwd":"/tmp"}`): every field is optional.
- Non-ASCII glyphs that are private-use (the Nerd Font branch glyph U+E0A0) are written as `printf` octal escapes, never as raw characters (editors and tools drop them silently).
- Colors are 24-bit ANSI through `esc '<params>'`; palette: white 255,255,255; gray 128,128,128; fuchsia 255,0,255 (ctx); sky blue 135,206,235 (lmt); light green 144,238,144 (rst); gray-green 132,136,132 (pch); khaki 212,201,106 (sha); violet bold 170,127,240 (branch); coral bold 239,100,124 (flags); snow 255,250,250 (session).
- The status line runs the installed copy, never the plugin folder (a GitHub install's folder changes with each version).

## Tasks

**Status / health check**: run `sh <this skill's base directory>/scripts/status.sh` and report: install state and version, repo changes, whether the installed copy matches the repo, wiring, the sample render.

**Change the status line**
1. Edit `statusline/prompt-view.sh` in the repo, matching its style (2-space indent, one segment per block with a comment).
2. Render before and after with a sample input and show the user plain text (`sed $'s/\e\\[[0-9;]*m//g'`); a sample with every field: `session_id`, `session_name`, `model.display_name`, `workspace.current_dir`, `transcript_path`, `cost.total_duration_ms`, `effort.level`, `thinking.enabled`, `output_style.name`, `fast_mode`, `context_window.used_percentage`, `context_window.current_usage.{input_tokens,cache_creation_input_tokens,cache_read_input_tokens}`, `rate_limits.five_hour.{used_percentage,resets_at}`.
3. `claude plugin validate ~/Projects/claude-agent-prompt-view` must end with `✔ Validation passed`, no warnings.
4. Bump `version` in `.claude-plugin/plugin.json` (patch for fixes, minor for new segments) and update `README.md` when the lines change.
5. Apply: the installed copy is refreshed on the next `session.start`; in a running session ask the user to type `/reload-plugins` (Claude cannot run slash commands). For an instant preview, `cp` the script to the installed path.

**Change the hooks module**: type-check it like agent-count: load the `plugin-authoring` skill for this build's `claude-code.d.ts`, tsconfig in the scratchpad with `strict`, `target: es2023`, `module: esnext`, `moduleResolution: bundler`, `lib: [es2023]`, `noEmit`, `types: []`, `include` = that d.ts + the repo's `hooks/`, then `npx -y -p typescript@5.6.3 tsc -p <scratchpad>`. Every hook keeps `.catch(($, e, next) => next(e))`.

**Wire / re-wire the status line**: set `statusLine` to `{ "type": "command", "command": "sh \"$HOME/.claude/agent-prompt-view/statusline.sh\"", "refreshInterval": 1 }` with a JSON-aware tool (python `json`/`jq`), backing up `settings.json` first (`settings.json.bak-agent-prompt-view`).

**Enable / disable / uninstall**
```sh
claude plugin enable  agent-prompt-view@agent-prompt-view
claude plugin disable agent-prompt-view@agent-prompt-view
claude plugin uninstall agent-prompt-view@agent-prompt-view && claude plugin marketplace remove agent-prompt-view
```
Disabling or uninstalling leaves the installed copy, so the status line keeps working with the last version. Offer to restore the previous `statusLine` from the backup and to delete `~/.claude/agent-prompt-view/`; ask before deleting.

**Release / publish**: remote `origin` = `https://github.com/0exp/claude-agent-prompt-view`, branch `main`. Commit and push only when the user asks (pushing is outward-facing: confirm first unless the request says to push); bump `version` before a release. Others install with `/plugin install agent-prompt-view --marketplace 0exp/claude-agent-prompt-view` and update with `claude plugin marketplace update agent-prompt-view`.

## Debugging

- Status line empty or stale: the installed copy is missing or old (status script), `jq` missing, or `statusLine.command` not wired. Run the copy by hand: `echo '{"model":{"display_name":"X"},"cwd":"/tmp"}' | sh ~/.claude/agent-prompt-view/statusline.sh`.
- Second line missing: the agent-count mod is not loaded or has not written a file for this session yet.
- `stime` wrong off macOS: `stat -f %B` is BSD; the fallback is `cost.total_duration_ms`.
- Branch glyph shown as a box: the terminal font is not a Nerd Font.
