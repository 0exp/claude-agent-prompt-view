import type { EngineInterface, Register } from 'claude-code'

// the plugin's folder moves with each GitHub update: the status line runs a
// copy at a stable path, refreshed from the shipped script on every session start
const SCRIPT = 'statusline/prompt-view.sh'
const TARGET = '.claude/agent-prompt-view/statusline.sh'
// the options the script reads (a change in /config reloads the module, and
// session.start fires again)
const CONFIG = '.claude/agent-prompt-view/config'

// writes the file only when its text changed
async function sync($: EngineInterface, path: string, text: string) {
  const current = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined

  if (current !== text) await $.fs.write(path, text)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const home = await $.env.get('HOME')

    await sync($, `${home}/${TARGET}`, await $.fs.read(`${$.plugin.root}/${SCRIPT}`))
    await sync($, `${home}/${CONFIG}`, `clawd=${options.clawd !== false}\n`)

    return next(e)
  }).catch(($, e, next) => next(e))
}
