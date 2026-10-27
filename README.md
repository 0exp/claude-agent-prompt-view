# agent-prompt-view

A Claude Code mod that ships a five-line status line for under the prompt:

```
Opus 5.5 -> [demo] (sid:419e75ee) <stime:1h23m>
(effort:high) (thinkmode:thinking) (outstyle:Proactive) (fastmode:false)                         ▐▛███▜▌
⚙ main:thinking (1m13s) │ agents:0 (sub:0 sh:0 mon:0) -> pending:0 running:0 waiting:0 idle:0  ▝▜█████▛▘
ctx ███░░░░░░░ 37% | lmt ████░░░░░░ 43% | rst ██████░░░░ 1h56m (at 17h48m) | pch ████████░░ 85%   ▘▘ ▝▝
 (08d3788a) main [+#?] | ~/Projects/demo                                                        2.1.303
```

1. Model, session name, short session id, session time (`stime`, from the
   transcript's creation time).
2. Modes: reasoning effort, thinking, output style, fast mode (each only when known).
3. The [agent-count](https://github.com/0exp/claude-agent-count) line, when that
   mod writes one for the session; skipped otherwise.
4. Bars: `ctx` context window used, `lmt` 5-hour rate limit used, `rst` time to
   its reset and, in orange, its local time (24-hour `HHhMMm`), `pch` prompt
   cache hits of the last request. All four show from the start: before the
   first response (or once the 5-hour window has reset) `lmt` is 0%, `rst` a
   whole 5h00m window and `pch` 0%.
5. Git: short sha, branch, flags (`+` staged, `#` untracked, `?` unstaged) and
   the working directory.

At the right edge of the terminal, vertically centered, sits Clawd, Claude's
mascot, in Claude orange, with the Claude Code version centered under its feet:
as far from the edge as the status line is from the left one (`pad` in the
script). When the width (`$COLUMNS`) is unknown or too narrow, Clawd sits right
next to the lines.

While Claude Code is busy (the agent-count line shows the main loop anything
but `idle`), Clawd moves: jump, spin around, sway, blink, cheer, wave, squash and
stretch, hop side to side, tap dance, shiver, fall to pixels and back. A new
random animation starts every 8 seconds, a frame per refresh (the status line
runs at most once a second). Without the agent-count mod Clawd stays still
(unless `Animate Clawd always` is on).

Clawd is an option, on by default: `Show Clawd` (`clawd`) in `/config`, or
`pluginConfigs["agent-prompt-view@agent-prompt-view"].options.clawd` in
`~/.claude/settings.json`. The mod writes it to
`~/.claude/agent-prompt-view/config` for the script on every session start and
on every change of the option.

`Animate Clawd always` (`clawdAnimate`, off by default) animates Clawd all the
time, busy or not; `/clawd-animate [on|off]` sets the same option (toggles it
with no argument).

`Clawd's animation` (`clawdAnimation`, `random` by default) picks the one
animation Clawd plays: `random`, `jump`, `spin`, `sway`, `blink`, `cheer`,
`wave`, `stretch`, `hop`, `tap`, `shiver`, `pixels`; `/clawd-animation <name>`
sets it, and shows the current one with no argument.

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
