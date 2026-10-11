# agent-prompt-view

A Claude Code mod that ships a five-line status line for under the prompt:

```
Opus 5.5 -> [demo] (sid:419e75ee) <stime:1h23m>
⚙ main:thinking (1m13s) │ agents:0 (sub:0 sh:0 mon:0) │ pending:0 running:0 waiting:0 idle:0
(effort:high) (thinkmode:thinking) (outstyle:Proactive) (fastmode:false)
ctx ███░░░░░░░ 37% | lmt ████░░░░░░ 43% | rst ██████░░░░ 1h56m | pch ████████░░ 85%
 (08d3788a) main [+#?] | ~/Projects/demo
```

1. Model, session name, short session id, session time (`stime`, from the
   transcript's creation time).
2. The [agent-count](https://github.com/0exp/claude-agent-count) line, when that
   mod writes one for the session; skipped otherwise.
3. Modes: reasoning effort, thinking, output style, fast mode (each only when known).
4. Bars: `ctx` context window used, `lmt` 5-hour rate limit used, `rst` time to
   its reset, `pch` prompt cache hits of the last request.
5. Git: short sha, branch, flags (`+` staged, `#` untracked, `?` unstaged) and
   the working directory.

The script is `statusline/prompt-view.sh`. On every session start the mod copies
it to `~/.claude/agent-prompt-view/statusline.sh`, a path that stays the same
across plugin updates, so the status line always runs the installed version.

## Install

```
/plugin install agent-prompt-view --marketplace 0exp/claude-agent-prompt-view
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in
every session).

## Show it in the status line

Point `statusLine` in `~/.claude/settings.json` at the installed copy:

```json
"statusLine": {
  "type": "command",
  "command": "sh \"$HOME/.claude/agent-prompt-view/statusline.sh\"",
  "refreshInterval": 1
}
```

Requires `jq` and `git`; the branch glyph needs a Nerd Font. The script uses
macOS `stat -f`; elsewhere `stime` falls back to the session's duration.

## Develop

The plugin ships the `daiver-agent-prompt-view` skill
(`skills/daiver-agent-prompt-view/`): it tells Claude how to check, change,
reload, wire up and release the mod.

```
claude --plugin-dir .          # run a session with the mod loaded from this folder
claude plugin validate .       # manifest, marketplace and hooks module
```
