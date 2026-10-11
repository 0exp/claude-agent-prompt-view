#!/bin/sh
# agent-prompt-view: the status line under the prompt.
# Reads the status line JSON on stdin and prints:
#   1. model -> [session] (sid:…) <stime:…>
#   2. the agent-count line, when the agent-count mod writes one for this session
#   3. modes: effort, thinkmode, outstyle, fastmode
#   4. ctx / lmt / rst / pch bars
#   5. git sha, branch, flags | directory
# Requires jq. Usage in statusLine.command: sh <path>/prompt-view.sh

input=$(cat)
modes=''

esc() { printf '\033[%sm' "$1"; }
reset=$(esc 0)
bold=$(esc 1)
unbold=$(esc 22)
gray=$(esc '38;2;128;128;128')
white=$(esc '38;2;255;255;255')

# a 10-cell bar of a percentage
bar() {
  f=$(($1 / 10))
  [ $f -gt 10 ] && f=10
  [ $f -lt 0 ] && f=0
  o=''
  i=0
  while [ $i -lt 10 ]; do
    if [ $i -lt $f ]; then o="${o}█"; else o="${o}░"; fi
    i=$((i + 1))
  done
  printf '%s' "$o"
}

dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
case "$dir" in "$HOME"*) dir="~${dir#"$HOME"}" ;; esac

# line 1: model -> [session] (sid:…) <stime:…>
mname="${white}$(echo "$input" | jq -r '.model.display_name')${reset}"
model=''
sid=$(echo "$input" | jq -r '.session_id // empty' | cut -c1-8)
[ -n "$sid" ] && model="${gray}(${bold}sid:${unbold}$sid)${reset} $model"

# session time: from the transcript's birth time, else the session's duration
tp=$(echo "$input" | jq -r '.transcript_path // empty')
st0=''
[ -n "$tp" ] && [ -f "$tp" ] && st0=$(stat -f %B "$tp" 2>/dev/null)
if [ -n "$st0" ] && [ "$st0" -gt 0 ] 2>/dev/null; then
  el=$(($(date +%s) - st0))
else
  el=$(($(echo "$input" | jq -r '.cost.total_duration_ms // 0' | awk '{printf "%d", $1}') / 1000))
fi
[ $el -lt 0 ] && el=0
stm="$((el / 3600))h$(printf '%02d' $((el % 3600 / 60)))m"
model="${model}${gray}<${bold}stime:${unbold}$stm>${reset} "

# line 3: modes
effort=$(echo "$input" | jq -r '.effort.level // empty')
[ -n "$effort" ] && modes="$modes (${bold}effort${unbold}:$effort)"
thinking=$(echo "$input" | jq -r '.thinking.enabled')
case "$thinking" in
  true) modes="$modes (${bold}thinkmode${unbold}:thinking)" ;;
  false) modes="$modes (${bold}thinkmode${unbold}:non-thinking)" ;;
esac
ostyle=$(echo "$input" | jq -r '.output_style.name // empty')
[ -n "$ostyle" ] && modes="$modes (${bold}outstyle${unbold}:$ostyle)"
fast=$(echo "$input" | jq -r '.fast_mode')
case "$fast" in true | false) modes="$modes (${bold}fastmode${unbold}:$fast)" ;; esac

session=$(echo "$input" | jq -r '.session_name // empty')
model="$(esc '38;2;255;250;250')[${bold}$session${unbold}]${reset} $model"
model="$mname -> ${model% }"

# line 4: context, 5-hour limit, its reset, prompt cache hits
ctx=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | awk '{printf "%d", $1}')
five=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
out="ctx $(esc '38;2;255;0;255')$(bar $ctx)${reset} ${ctx}%"
if [ -n "$five" ]; then
  five=$(printf '%.0f' "$five")
  out="$out | lmt $(esc '38;2;135;206;235')$(bar $five)${reset} ${five}%"
fi
rst=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
if [ -n "$rst" ]; then
  left=$((rst - $(date +%s)))
  [ $left -lt 0 ] && left=0
  [ $left -gt 18000 ] && left=18000
  out="$out | rst $(esc '38;2;144;238;144')$(bar $(((18000 - left) * 100 / 18000)))${reset} $((left / 3600))h$(printf '%02d' $((left % 3600 / 60)))m"
fi
cch=$(echo "$input" | jq -r '.context_window.current_usage // empty | ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)) as $t | if $t > 0 then ((.cache_read_input_tokens // 0) * 100 / $t | floor) else empty end')
[ -n "$cch" ] && out="$out | pch $(esc '38;2;132;136;132')$(bar $cch)${reset} ${cch}%"

printf '%s\n' "$model"
af="$HOME/.claude/agent-count/$(echo "$input" | jq -r '.session_id // empty')"
[ -f "$af" ] && cat "$af"
[ -n "$modes" ] && printf '%s\n' "${modes# }"
printf '%s\n' "$out"

# line 5: git sha, branch, flags (+ staged, # untracked, ? unstaged) | directory
if [ -n "$dir" ]; then
  rawdir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
  branch=''
  if git -C "$rawdir" --no-optional-locks rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch=$(git -C "$rawdir" --no-optional-locks branch --show-current 2>/dev/null)
    [ -z "$branch" ] && branch=$(git -C "$rawdir" --no-optional-locks rev-parse --short HEAD 2>/dev/null)
    sha=$(git -C "$rawdir" --no-optional-locks rev-parse --short=8 HEAD 2>/dev/null)
    [ -n "$sha" ] && sha="${gray}($(esc '38;2;212;201;106')$sha${gray})${reset} "
    st=$(git -C "$rawdir" --no-optional-locks status --porcelain 2>/dev/null)
    flags=''
    printf '%s\n' "$st" | grep -q '^[MADRCTU]' && flags="$flags+"
    printf '%s\n' "$st" | grep -q '^??' && flags="$flags#"
    printf '%s\n' "$st" | grep -q '^.[MADRCTU]' && flags="$flags?"
  fi
  if [ -n "$branch" ]; then
    violet=$(esc '1;38;2;170;127;240')
    icon=$(printf '\356\202\240') # Nerd Font branch glyph (U+E0A0)
    printf '%s\n' "${violet}${icon}${reset} $sha${violet}$branch${reset} $(esc '1;38;2;239;100;124')[$flags]${reset} | ${white}$dir${reset}"
  else
    printf '%s\n' "${white}$dir${reset}"
  fi
fi
