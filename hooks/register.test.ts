import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const CONFIG = '/home/me/.claude/agent-prompt-view/config'

// the world beneath the plugin: a filesystem in memory (the shipped script and
// what the plugin writes), the plugin's /config rows and their changes
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
  const provider = { plugin: 'agent-prompt-view', tier: 'user' } as const
  on('config.list', $ => ({
    value: [
      { key: `${$.plugin.name}.clawdAnimate`, label: 'Animate Clawd always', kind: 'boolean', value: false, provider, isLocked: false },
      { key: `${$.plugin.name}.clawdAnimation`, label: "Clawd's animation", kind: 'choice', value: 'random', provider, isLocked: false },
    ],
  }))
  on('config.set', ($, e) => {
    sets.push(`${e.key.split('.').at(-1)}=${e.value}`)
    return { value: e.value }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  mock.env(on, { HOME: '/home/me' })

  return { files, sets }
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const
// a command of the plugin typed at the prompt
const run = (args: string, command = 'clawd-animate') => ({
  command,
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
}) as const

test('Clawd is on and animates only while busy by default', async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\nanimation=random\n')
  expect(files.get('/home/me/.claude/agent-prompt-view/statusline.sh')).toBe('#!/bin/sh\n')
})

test('the clawd option turns Clawd off', { options: { clawd: false } }, async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=false\nanimate=false\nanimation=random\n')
})

test('the clawdAnimate option animates Clawd all the time', { options: { clawdAnimate: true } }, async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=true\nanimation=random\n')
})

test('/clawd-animate toggles the option, on and off set it', async ($, on) => {
  const { files, sets } = world(on)

  await $.session.start(start)

  expect((await $.command.run(run(''))).text).toBe('Clawd now animates all the time.')
  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=true\nanimation=random\n')
  await $.command.run(run('off'))
  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\nanimation=random\n')
  await $.command.run(run('on'))
  expect(sets).toEqual(['clawdAnimate=true', 'clawdAnimate=false', 'clawdAnimate=true'])
  expect((await $.command.run(run('maybe'))).text).toBe('Usage: /clawd-animate [on|off]')
})

test('the clawdAnimation option names the animation', { options: { clawdAnimation: 'pixels' } }, async ($, on) => {
  const { files } = world(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\nanimation=pixels\n')
})

test('/clawd-animation sets the option, shows it with no argument', async ($, on) => {
  const { files, sets } = world(on)

  await $.session.start(start)

  expect((await $.command.run(run('', 'clawd-animation'))).text).toContain("Clawd's animation: random")
  expect((await $.command.run(run('spin', 'clawd-animation'))).text).toBe('Clawd now plays spin.')
  expect(files.get(CONFIG)).toBe('clawd=true\nanimate=false\nanimation=spin\n')
  await $.command.run(run('random', 'clawd-animation'))
  expect(sets).toEqual(['clawdAnimation=spin', 'clawdAnimation=random'])
  expect((await $.command.run(run('moonwalk', 'clawd-animation'))).text).toContain('Usage: /clawd-animation [random|jump|')
})
