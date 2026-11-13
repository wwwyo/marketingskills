const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const cli = path.resolve(__dirname, '../../tools/clis/lighthouse.js')

function run(args) {
  const res = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, CHROME_PATH: '/fixture/chrome' } })
  return { status: res.status, payload: JSON.parse(res.stdout || res.stderr) }
}

test('dry run builds one bunx command per url and strategy', () => {
  const { status, payload } = run(['audit', '--url', 'https://a.test/,https://b.test/x', '--strategy', 'both', '--dry-run'])
  assert.equal(status, 0)
  assert.equal(payload.commands.length, 4)
  const [first, second] = payload.commands
  assert.equal(first[0], 'bunx')
  assert.match(first[1], /^lighthouse@\d+\.\d+\.\d+$/)
  assert.equal(first[2], 'https://a.test/')
  assert.ok(!first.includes('--preset=desktop'))
  assert.ok(second.includes('--preset=desktop'))
  assert.ok(first.includes('--chrome-path=/fixture/chrome'))
})

test('rejects non-http urls and out-of-range runs', () => {
  assert.equal(run(['audit', '--url', 'file:///etc/passwd', '--dry-run']).status, 1)
  assert.equal(run(['audit', '--url', 'https://a.test/', '--runs', '9', '--dry-run']).status, 1)
  assert.equal(run(['audit', '--url', 'https://a.test/', '--strategy', 'tablet', '--dry-run']).status, 1)
})
