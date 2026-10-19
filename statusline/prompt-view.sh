#!/bin/sh
# agent-prompt-view: the status line under the prompt.
# Reads the status line JSON on stdin and prints:
#   1. model -> [session] (sid:…) <stime:…>
#   2. modes: effort, thinkmode, outstyle, fastmode
#   3. the agent-count line, when the agent-count mod writes one for this session
#   4. ctx / lmt / rst / pch bars
#   5. git sha, branch, flags | directory
# with Clawd, Claude's mascot, at the right edge of the terminal
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

# line 2: modes
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

af="$HOME/.claude/agent-count/$(echo "$input" | jq -r '.session_id // empty')"

# the panel's lines, before Clawd is added
panel() {
  printf '%s\n' "$model"
  [ -n "$modes" ] && printf '%s\n' "${modes# }"
  [ -f "$af" ] && cat "$af"
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
}

# Clawd is the mod's option (userConfig `clawd`, on by default): the hooks
# module writes it to the config file next to this script
if grep -qx 'clawd=false' "$HOME/.claude/agent-prompt-view/config" 2>/dev/null; then
  panel
  exit 0
fi

# Clawd, Claude's mascot, at the right edge (vertically centered): as far from
# the edge as the status line is from the left one; next to the panel when the
# terminal width ($COLUMNS) is unknown or too narrow; the Claude Code version
# centered under its feet. While Claude Code is busy (the agent-count line's
# main loop is not idle) Clawd plays one of eleven animations, a new random one
# every few seconds, a frame per refresh (the status line runs once a second)
orange=$(esc '38;2;215;119;87')
ver=$(echo "$input" | jq -r '.version // empty')
e=$(printf '\033')

# a pose on Clawd's 11-cell canvas: r0 is the spare line above it, r1-r3 its
# body (at rest in cells 1-9: cell 0 and 10 are room to move sideways)
pose() {
  r0=''
  r1='  ▐▛███▜▌'
  r2=' ▝▜█████▛▘'
  r3='   ▘▘ ▝▝'
  case "$1" in
    up) r0=$r1 r1=$r2 r2=$r3 r3='' ;;
    squash) r1='' r2='▝▐▛█████▜▌▘' r3='  ▀▀   ▀▀' ;;
    stretch) r0='   ▐▛█▜▌' r1='   ▐███▌' r2='  ▝▜███▛▘' r3='    ▘ ▝' ;;
    turn) r1='   ▐▛██▌' r2='  ▝▜████▛' r3='    ▘▘ ▝' ;;
    side) r1='    ▐▛▌' r2='   ▝███▘' r3='    ▘▝' ;;
    back) r1='  ▐█████▌' ;;
    turnback) r1='   ▐██▜▌' r2='  ▜████▛▘' r3='    ▘ ▝▝' ;;
    blink) r1='  ▐▀███▀▌' ;;
    cheer) r1=' ▗▐▛███▜▌▖' r2='  ▜█████▛' ;;
    wave) r1='  ▐▛███▜▌▖' r2=' ▝▜█████▛' ;;
    tapl) r3='      ▝▝' ;;
    tapr) r3='   ▘▘' ;;
    crack) r0='      ▝' r1='  ▐▛▞█▜▘ ▗' r2=' ▝▜█▚██▛▖' r3='   ▘▖ ▝▗' ;;
    scatter) r0='  ▗   ▘  ▝' r1=' ▘ ▚▝▞▖▘ ▗' r2='▖ ▞▗▚ ▘▞ ▝' r3='  ▝ ▖ ▗ ▘' ;;
    dust) r0=' ▝    ▖   ▗' r1='▗   ▘    ▝' r2='   ▖   ▗' r3='▘    ▝    ▖' ;;
  esac
  case "$2" in
    L) r0=${r0# } r1=${r1# } r2=${r2# } r3=${r3# } ;;
    R) for r in r0 r1 r2 r3; do eval "[ -n \"\$$r\" ] && $r=\" \$$r\""; done ;;
  esac
}

# the animations, by the names the clawdAnimation option takes: one
# pose[:L|R shift] per frame
anims='jump spin sway blink cheer wave stretch hop tap shiver pixels'
anim() {
  case "$1" in
    jump) echo 'rest squash up rest' ;;
    spin) echo 'rest turn side back side turnback' ;;
    sway) echo 'rest rest:L rest rest:R' ;;
    blink) echo 'rest rest blink rest' ;;
    cheer) echo 'rest cheer rest cheer' ;;
    wave) echo 'wave rest wave rest' ;;
    stretch) echo 'rest squash rest stretch' ;;                     # squash and stretch
    hop) echo 'rest up:R rest up:L' ;;                              # hop side to side
    tap) echo 'rest tapl rest tapr' ;;                              # tap dance
    shiver) echo 'rest:L rest:R rest:L rest:R' ;;
    pixels) echo 'rest crack scatter dust scatter crack' ;;         # fall to pixels and back
  esac
}
# the clawdAnimation option (/clawd-animation): one of them, or random
animation=$(sed -n 's/^animation=//p' "$HOME/.claude/agent-prompt-view/config" 2>/dev/null)
case " $anims " in *" $animation "*) ;; *) animation='' ;; esac

busy=''
# the clawdAnimate option (/clawd-animate): animate whether busy or not
grep -qx 'animate=true' "$HOME/.claude/agent-prompt-view/config" 2>/dev/null && busy=1
[ -z "$busy" ] && [ -f "$af" ] && head -n 1 "$af" | sed "s/$e\[[0-9;]*m//g" | grep -q 'main:' &&
  ! head -n 1 "$af" | sed "s/$e\[[0-9;]*m//g" | grep -q 'main:idle' && busy=1

if [ -n "$busy" ]; then
  now=$(date +%s)
  # random: a new one every 8 seconds, never the same twice in a row
  rnd() {
    x=$((($1 * 2654435761) & 4294967295))
    x=$((((x ^ (x >> 16)) * 73244475) & 4294967295))
    echo $(((x ^ (x >> 16)) % 11))
  }
  if [ -z "$animation" ]; then
    k=$(rnd $((now / 8)))
    [ "$k" -eq "$(rnd $((now / 8 - 1)))" ] && k=$(((k + 1) % 11))
    set -- $anims
    shift $k
    animation=$1
  fi
  set -- $(anim "$animation")
  shift $((now % $#))
  sh=''
  case "$1" in *:*) sh=${1##*:} ;; esac
  pose "${1%%:*}" "$sh"
else
  pose rest
fi

clawd() {
  case "$1" in
    -1) r=$r0 ;;
    0) r=$r1 ;;
    1) r=$r2 ;;
    2) r=$r3 ;;
    3) r="$(printf '%*s' $(((11 - ${#ver}) / 2)) '')${gray}$ver" ;;
  esac
  [ -n "$r" ] && printf '%s' "${orange}$r${reset}"
}
h=3
[ -n "$ver" ] && h=4
# the visible width of a line: no color escapes, one cell per UTF-8 character
vis() { printf '%s' "$1" | sed "s/$e\[[0-9;]*m//g" | LC_ALL=C tr -d '\200-\277' | wc -c | tr -d ' '; }
lines=$(panel)
n=$(printf '%s\n' "$lines" | wc -l | tr -d ' ')
# at least one spare line, so Clawd sits off the prompt (and has room to jump)
while [ "$n" -le $h ]; do lines="$lines
"; n=$((n + 1)); done
w=0
while IFS= read -r l; do
  v=$(vis "$l")
  [ "$v" -gt "$w" ] && w=$v
done <<EOF
$lines
EOF
top=$(((n - h + 1) / 2)) # an odd spare line goes above, off the prompt
pad=2 # the status line's left indent
# the canvas' first cell: the whole canvas (a step right included) ends pad
# cells before the right edge
col=$((w + 1))
case "$COLUMNS" in '' | *[!0-9]*) ;; *) [ $((COLUMNS - 2 * pad - 11)) -gt $col ] && col=$((COLUMNS - 2 * pad - 11)) ;; esac
i=0
while IFS= read -r l; do
  a=$((i - top))
  c=''
  [ $a -ge -1 ] && [ $a -lt $h ] && c=$(clawd $a)
  if [ -n "$c" ]; then
    printf '%s%*s%s\n' "$l" $((col - $(vis "$l"))) '' "$c"
  else
    printf '%s\n' "$l"
  fi
  i=$((i + 1))
done <<EOF
$lines
EOF
