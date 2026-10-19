import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const CONFIG = '/home/me/.claude/agent-prompt-view/config'

// the world beneath the plugin: a filesystem in memory (the shipped script and
// what the plugin writes), the clawdAnimate row of /config and its changes
function world(on: On) {
  const files = new Map<string, string>()
  const sets: unknown[] = []

  on('fs.exists', ($, e) => ({ value: files.has(e.path) || e.path.endsWith('/statusline/prompt-view.sh') }))
  on('fs.read', ($, e) => ({ value: files.get(e.path) ?? '#!/bin/sh\n' }))
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.list', $ => ({
    value: [
      {
        key: `${$.plugin.name}.clawdAnimate`,
        label: 'Animate Clawd always',
        kind: 'boolean',
        value: false,
        provider: { plugin: 'agent-prompt-view', tier: 'user' },
        isLocked: false,
      },
    ],
  }))
  on('config.set', ($, e) => {
    sets.push(e.value)
    return { value: e.value }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  mock.env(on, { HOME: '/home/me' })

  return { files, sets }
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const
// /clawd-animate typed at the prompt
const run = (args: string) => ({
  command: 'clawd-animate',
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
}) as const

test('Clawd is on and animates only while busy by default', async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\n')
  expect(files.get('/home/me/.claude/agent-prompt-view/statusline.sh')).toBe('#!/bin/sh\n')
})

test('the clawd option turns Clawd off', { options: { clawd: false } }, async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=false\nanimate=false\n')
})

test('the clawdAnimate option animates Clawd all the time', { options: { clawdAnimate: true } }, async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=true\n')
})

test('/clawd-animate toggles the option, on and off set it', async ($, on) => {
  const { files, sets } = world(on)

  await $.session.start(start)

  expect((await $.command.run(run(''))).text).toBe('Clawd now animates all the time.')
  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=true\n')
  await $.command.run(run('off'))
  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\n')
  await $.command.run(run('on'))
  expect(sets).toEqual([true, false, true])
  expect((await $.command.run(run('maybe'))).text).toBe('Usage: /clawd-animate [on|off]')
})
