import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const CONFIG = '/home/me/.claude/agent-prompt-view/config'

// a filesystem in memory beneath the plugin: the shipped script and what it writes
function fs(on: On) {
  const files = new Map<string, string>()

  on('fs.exists', ($, e) => ({ value: files.has(e.path) || e.path.endsWith('/statusline/prompt-view.sh') }))
  on('fs.read', ($, e) => ({ value: files.get(e.path) ?? '#!/bin/sh\n' }))
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  mock.env(on, { HOME: '/home/me' })

  return files
}

const start = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

test('Clawd is on by default', async ($, on) => {
  const files = fs(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=true\n')
  expect(files.get('/home/me/.claude/agent-prompt-view/statusline.sh')).toBe('#!/bin/sh\n')
})

test('the clawd option turns Clawd off', { options: { clawd: false } }, async ($, on) => {
  const files = fs(on)

  await $.session.start(start)

  expect(files.get(CONFIG)).toBe('clawd=false\n')
})
