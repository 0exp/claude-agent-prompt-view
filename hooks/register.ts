import type { Register } from 'claude-code'

// the plugin's folder moves with each GitHub update: the status line runs a
// copy at a stable path, refreshed from the shipped script on every session start
const SCRIPT = 'statusline/prompt-view.sh'
const TARGET = '.claude/agent-prompt-view/statusline.sh'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const source = await $.fs.read(`${$.plugin.root}/${SCRIPT}`)
    const target = `${await $.env.get('HOME')}/${TARGET}`
    const current = (await $.fs.exists(target)) ? await $.fs.read(target) : undefined

    if (current !== source) await $.fs.write(target, source)

    return next(e)
  }).catch(($, e, next) => next(e))
}
