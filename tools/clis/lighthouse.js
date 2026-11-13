#!/usr/bin/env node

// Runs Google Lighthouse (the engine behind PageSpeed Insights) locally through
// `bunx`, so no install and no API key are needed. Prints a compact JSON summary.

const { spawnSync } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync, existsSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const LIGHTHOUSE_VERSION = '12.8.2'
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const CHROME_CANDIDATES = [
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(process.argv.slice(2))
const [cmd] = args._

function usage() {
  return {
    usage: 'lighthouse audit --url <url>[,<url2>...] [--strategy mobile|desktop|both] [--runs 1-5] [--chrome-path <path>] [--dry-run]',
    notes: [
      `Runs lighthouse@${LIGHTHOUSE_VERSION} via bunx (needs bun and a Chrome/Chromium).`,
      'Lab data only, same engine and mobile throttling as PageSpeed Insights. Field data (CrUX) is not included.',
      'Chrome is found from --chrome-path, CHROME_PATH, or common install paths.',
      'With --runs > 1 the median performance run is reported; the first run often hits a cold CDN cache.',
    ],
  }
}

function chromePath() {
  if (typeof args['chrome-path'] === 'string') return args['chrome-path']
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return CHROME_CANDIDATES.find(p => existsSync(p))
}

function lighthouseArgs(url, strategy, outputPath, chrome) {
  const list = [
    `lighthouse@${LIGHTHOUSE_VERSION}`, url,
    `--only-categories=${CATEGORIES.join(',')}`,
    '--output=json', `--output-path=${outputPath}`,
    '--chrome-flags=--headless=new --no-sandbox',
    '--quiet',
  ]
  if (strategy === 'desktop') list.push('--preset=desktop')
  if (chrome) list.push(`--chrome-path=${chrome}`)
  return list
}

function display(audits, id) {
  return audits[id]?.displayValue ?? null
}

function summarize(report) {
  const a = report.audits
  const scores = Object.fromEntries(
    Object.entries(report.categories).map(([k, c]) => [k, c.score === null ? null : Math.round(c.score * 100)]),
  )
  const opportunities = Object.values(a)
    .filter(x => x.details?.type === 'opportunity' && x.score !== null && x.score < 0.9 && x.numericValue > 0)
    .map(x => ({ id: x.id, title: x.title, savings: x.displayValue ?? null }))
  const failed = Object.values(a)
    .filter(x => x.score !== null && x.score < 0.9 && x.scoreDisplayMode === 'binary')
    .map(x => x.id)
  const bootup = [...(a['bootup-time']?.details?.items ?? [])]
    .sort((x, y) => (y.scripting ?? 0) - (x.scripting ?? 0))
    .slice(0, 3)
    .map(i => ({ url: i.url, scriptingMs: Math.round(i.scripting ?? 0) }))
  return {
    scores,
    metrics: {
      fcp: display(a, 'first-contentful-paint'),
      lcp: display(a, 'largest-contentful-paint'),
      tbt: display(a, 'total-blocking-time'),
      cls: display(a, 'cumulative-layout-shift'),
      speedIndex: display(a, 'speed-index'),
      ttfb: display(a, 'server-response-time'),
      totalBytes: display(a, 'total-byte-weight'),
    },
    lcpElement: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? null,
    topScripts: bootup,
    opportunities,
    failedAudits: failed,
  }
}

function runOnce(url, strategy, chrome) {
  const dir = mkdtempSync(path.join(tmpdir(), 'lighthouse-'))
  const out = path.join(dir, 'report.json')
  try {
    const res = spawnSync('bunx', lighthouseArgs(url, strategy, out, chrome), { encoding: 'utf8', timeout: 300000 })
    if (res.error) return { error: `failed to start bunx: ${res.error.message}` }
    if (res.status !== 0 || !existsSync(out)) {
      return { error: `lighthouse exited with ${res.status}`, stderr: (res.stderr || '').trim().split('\n').slice(-5).join('\n') }
    }
    const report = JSON.parse(readFileSync(out, 'utf8'))
    if (report.runtimeError) return { error: report.runtimeError.message }
    return summarize(report)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function median(runs) {
  const ok = runs.filter(r => !r.error)
  if (ok.length === 0) return runs[0]
  const sorted = [...ok].sort((x, y) => (x.scores.performance ?? 0) - (y.scores.performance ?? 0))
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

function main() {
  if (cmd !== 'audit' || !args.url || args.url === true) {
    console.log(JSON.stringify(usage(), null, 2))
    process.exit(cmd ? 1 : 0)
  }
  const urls = String(args.url).split(',').map(s => s.trim()).filter(Boolean)
  for (const u of urls) {
    if (!/^https?:\/\//.test(u)) {
      console.error(JSON.stringify({ error: `--url must start with http:// or https:// (${u})` }))
      process.exit(1)
    }
  }
  const strategyArg = args.strategy ?? 'mobile'
  if (!['mobile', 'desktop', 'both'].includes(strategyArg)) {
    console.error(JSON.stringify({ error: '--strategy must be mobile, desktop or both' }))
    process.exit(1)
  }
  const runs = Number(args.runs ?? '1')
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) {
    console.error(JSON.stringify({ error: '--runs must be an integer from 1 to 5' }))
    process.exit(1)
  }
  const strategies = strategyArg === 'both' ? ['mobile', 'desktop'] : [strategyArg]
  const chrome = chromePath()

  if (args['dry-run']) {
    const commands = urls.flatMap(u => strategies.map(s => ['bunx', ...lighthouseArgs(u, s, '<tmp>/report.json', chrome)]))
    console.log(JSON.stringify({ _dry_run: true, runs, commands }, null, 2))
    return
  }

  const results = []
  for (const url of urls) {
    for (const strategy of strategies) {
      const all = Array.from({ length: runs }, () => runOnce(url, strategy, chrome))
      const picked = median(all)
      const entry = { url, strategy, ...picked }
      if (runs > 1) entry.performanceRuns = all.map(r => r.error ? null : r.scores.performance)
      if (picked.error) process.exitCode = 1
      results.push(entry)
    }
  }
  console.log(JSON.stringify({ lighthouse: LIGHTHOUSE_VERSION, results }, null, 2))
}

main()
