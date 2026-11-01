import type { ConfigValue, EngineInterface, Register } from 'claude-code'

// the plugin's folder moves with each GitHub update: the status line runs a
// copy at a stable path, refreshed from the shipped script on every session start
const SCRIPT = 'statusline/prompt-view.sh'
const TARGET = '.claude/agent-prompt-view/statusline.sh'
// the options the script reads (a change in /config reloads the module, and
// session.start fires again)
const CONFIG = '.claude/agent-prompt-view/config'
// Clawd's animations, as the script and the clawdAnimation option name them
const ANIMATIONS = ['random', 'jump', 'spin', 'sway', 'blink', 'cheer', 'wave', 'stretch', 'hop', 'tap', 'shiver', 'pixels']
// the status line's input has no auto memory state: this folder holds it, a file
// per session (`on` or `off`), for the script's <automemory:…> segment
const AUTO_MEMORY = '.claude/agent-prompt-view/automemory'
const AUTO_MEMORY_KEY = 'autoMemoryEnabled'

type Config = { clawd: boolean; animate: boolean; animation: string }

// writes the file only when its text changed
async function sync($: EngineInterface, path: string, text: string) {
  const current = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined

  if (current !== text) await $.fs.write(path, text)
}

async function writeConfig($: EngineInterface, config: Config) {
  const text = `clawd=${config.clawd}\nanimate=${config.animate}\nanimation=${config.animation}\n`

  await sync($, `${await $.env.get('HOME')}/${CONFIG}`, text)
}

// sets this plugin's /config row of the field; the reason when it was refused
async function setOption($: EngineInterface, field: string, value: ConfigValue) {
  const row = (await $.config.list()).find(one => one.provider.plugin === $.plugin.name && one.key.endsWith(`.${field}`))

  return row === undefined ? undefined : (await $.config.set({ key: row.key, value })).deny
}

// /pause-memory, as the prompt footer's mode label says it
let memoryPaused = false
// the engine left the memory section out though no setting turned it off: a kind
// of session without auto memory (remote, restricted, ...)
let memoryBlocked = false

// as the engine decides, for what a plugin can see: the switch variable beats the setting
async function autoMemoryOn($: EngineInterface) {
  const env = (await $.env.get('CLAUDE_CODE_DISABLE_AUTO_MEMORY'))?.toLowerCase() ?? ''

  if (memoryPaused || ['1', 'true', 'yes', 'on'].includes(env)) return false
  if (['0', 'false', 'no', 'off'].includes(env)) return true

  return !memoryBlocked && (await $.settings.read({ key: AUTO_MEMORY_KEY })) !== false
}

async function writeAutoMemory($: EngineInterface) {
  const path = `${await $.env.get('HOME')}/${AUTO_MEMORY}/${await $.session.id()}`

  await sync($, path, (await autoMemoryOn($)) ? 'on\n' : 'off\n')
}

export const register: Register = (on, options) => {
  const config: Config = {
    clawd: options.clawd !== false,
    animate: options.clawdAnimate === true,
    animation: ANIMATIONS.includes(String(options.clawdAnimation)) ? String(options.clawdAnimation) : 'random',
  }

  on('session.start', async ($, e, next) => {
    const home = await $.env.get('HOME')

    await sync($, `${home}/${TARGET}`, await $.fs.read(`${$.plugin.root}/${SCRIPT}`))
    await writeConfig($, config)
    await writeAutoMemory($)
    // a second's refresh, as the status line's: /memory changes the setting any time
    $.clock.every(1000, () => writeAutoMemory($))
    await $.command.register({
      name: 'clawd-animate',
      description: 'Animate Clawd in the status line all the time, not only while busy',
      argumentHint: '[on|off]',
    })
    await $.command.register({
      name: 'clawd-animation',
      description: "Clawd's animation: one of them, or a random one every few seconds",
      argumentHint: `[${ANIMATIONS.join('|')}]`,
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // the prompt's memory section is the engine's own answer for this session
  on('prompt.section', { name: 'memory' }, async ($, e, next) => {
    const result = await next(e)

    memoryBlocked = result.text === null && !memoryPaused && (await $.settings.read({ key: AUTO_MEMORY_KEY })) !== false
    await writeAutoMemory($)

    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    memoryPaused = e.props.modes.includes('memory paused')

    return next(e)
  }).catch(($, e, next) => next(e))

  // /clawd-animate [on|off]: the clawdAnimate option, toggled when no argument
  on('command.run', { command: 'clawd-animate' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Usage: /clawd-animate [on|off]' }

    const value = arg === '' ? !config.animate : arg === 'on'
    const deny = await setOption($, 'clawdAnimate', value)

    if (deny !== undefined) return { text: `Clawd's animation was not changed: ${deny}` }

    config.animate = value
    await writeConfig($, config)

    return { text: value ? 'Clawd now animates all the time.' : 'Clawd now animates only while Claude Code is busy.' }
  }).catch(($, e, next) => next(e))

  // /clawd-animation <name>: the clawdAnimation option; the current one when no argument
  on('command.run', { command: 'clawd-animation' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === '') return { text: `Clawd's animation: ${config.animation} (one of ${ANIMATIONS.join(', ')})` }
    if (!ANIMATIONS.includes(arg)) return { text: `Usage: /clawd-animation [${ANIMATIONS.join('|')}]` }

    const deny = await setOption($, 'clawdAnimation', arg)

    if (deny !== undefined) return { text: `Clawd's animation was not changed: ${deny}` }

    config.animation = arg
    await writeConfig($, config)

    return { text: arg === 'random' ? 'Clawd now plays a random animation.' : `Clawd now plays ${arg}.` }
  }).catch(($, e, next) => next(e))
}
