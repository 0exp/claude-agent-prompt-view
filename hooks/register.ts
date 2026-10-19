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
