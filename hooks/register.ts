import type { EngineInterface, Register } from 'claude-code'

// the plugin's folder moves with each GitHub update: the status line runs a
// copy at a stable path, refreshed from the shipped script on every session start
const SCRIPT = 'statusline/prompt-view.sh'
const TARGET = '.claude/agent-prompt-view/statusline.sh'
// the options the script reads (a change in /config reloads the module, and
// session.start fires again)
const CONFIG = '.claude/agent-prompt-view/config'
// /clawd-animate [on|off]: the clawdAnimate option, toggled when no argument
const COMMAND = 'clawd-animate'
const ANIMATE = 'clawdAnimate'

// writes the file only when its text changed
async function sync($: EngineInterface, path: string, text: string) {
  const current = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined

  if (current !== text) await $.fs.write(path, text)
}

async function writeConfig($: EngineInterface, clawd: boolean, animate: boolean) {
  await sync($, `${await $.env.get('HOME')}/${CONFIG}`, `clawd=${clawd}\nanimate=${animate}\n`)
}

export const register: Register = (on, options) => {
  const clawd = options.clawd !== false
  let animate = options[ANIMATE] === true

  on('session.start', async ($, e, next) => {
    const home = await $.env.get('HOME')

    await sync($, `${home}/${TARGET}`, await $.fs.read(`${$.plugin.root}/${SCRIPT}`))
    await writeConfig($, clawd, animate)
    await $.command.register({
      name: COMMAND,
      description: 'Animate Clawd in the status line all the time, not only while busy',
      argumentHint: '[on|off]',
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: `Usage: /${COMMAND} [on|off]` }

    const value = arg === '' ? !animate : arg === 'on'
    const row = (await $.config.list()).find(one => one.provider.plugin === $.plugin.name && one.key.endsWith(`.${ANIMATE}`))
    const set = row === undefined ? undefined : await $.config.set({ key: row.key, value })

    if (set?.deny !== undefined) return { text: `Clawd's animation was not changed: ${set.deny}` }

    animate = value
    await writeConfig($, clawd, animate)

    return { text: animate ? 'Clawd now animates all the time.' : 'Clawd now animates only while Claude Code is busy.' }
  }).catch(($, e, next) => next(e))
}
