# Lighthouse

Google's open-source page quality auditor, and the engine behind PageSpeed Insights. Measures performance (Core Web Vitals lab metrics), accessibility, best practices, and basic SEO for a single URL in a real headless Chrome.

## Capabilities

| Integration | Available | Notes |
|-------------|-----------|-------|
| API | - | Use the PageSpeed Insights API for hosted runs (needs an API key for regular use) |
| MCP | - | Not available |
| CLI | ✓ | [lighthouse.js](../clis/lighthouse.js) (runs `lighthouse` through `bunx`) |
| SDK | ✓ | `lighthouse` npm package |

## Authentication

None. The CLI runs Lighthouse on your machine, so there is no API key and no daily quota. It needs:

- **bun** (for `bunx`, which fetches the pinned Lighthouse version on first use)
- **Chrome or Chromium**, found from `--chrome-path`, `CHROME_PATH`, or common install paths

## When to Use It Instead of PageSpeed Insights

- The keyless PageSpeed Insights API shares a daily quota across all callers and often returns 429; Lighthouse locally does not
- You want to measure many pages, repeat runs, or check a preview deploy
- PageSpeed Insights adds **field data** (CrUX, real Chrome users over 28 days) on top of the same lab run. Lighthouse cannot give field data. For that, use the PageSpeed Insights site, the CrUX API, or the Search Console Core Web Vitals report. Low-traffic sites often have no field data at all

## Common Agent Operations

### Audit one page on mobile

```bash
node tools/clis/lighthouse.js audit --url https://example.com/
```

Mobile is the default and uses the same simulated mid-range phone and slow 4G as PageSpeed Insights.

### Mobile and desktop for several pages

```bash
node tools/clis/lighthouse.js audit --url https://example.com/,https://example.com/pricing --strategy both
```

### Repeat runs to smooth out noise

```bash
node tools/clis/lighthouse.js audit --url https://example.com/ --runs 3
```

Reports the median run by performance score, plus every run's score in `performanceRuns`.

### Preview the commands without running

```bash
node tools/clis/lighthouse.js audit --url https://example.com/ --strategy both --dry-run
```

## Output

```json
{
  "lighthouse": "12.8.2",
  "results": [{
    "url": "https://example.com/",
    "strategy": "mobile",
    "scores": { "performance": 82, "accessibility": 97, "best-practices": 100, "seo": 92 },
    "metrics": { "fcp": "2.0 s", "lcp": "3.3 s", "tbt": "400 ms", "cls": "0.003", "speedIndex": "2.0 s", "ttfb": "Root document took 40 ms", "totalBytes": "Total size was 685 KiB" },
    "lcpElement": "<span class=\"...\">",
    "topScripts": [{ "url": "https://example.com/assets/app.js", "scriptingMs": 1312 }],
    "opportunities": [{ "id": "unused-javascript", "title": "Reduce unused JavaScript", "savings": "Est savings of 48 KiB" }],
    "failedAudits": ["color-contrast"]
  }]
}
```

## Reading the Results

- **Thresholds**: LCP < 2.5 s, CLS < 0.1. Lab runs have no INP; use **TBT < 200 ms** as its stand-in
- **Cold vs warm cache**: the first run after a deploy or cache expiry often shows a slow `ttfb`. Crawlers usually hit a cold cache, so a slow first run matters even when repeat runs are fast
- **High TBT with one script in `topScripts`**: the page spends its time running JavaScript, not downloading. Look at hydration and heavy client-side rendering before image or network fixes
- **Scores move a few points between runs**. Compare medians, not single runs
- **Unknown robots.txt directives** (for example `Content-Signal`) fail the `robots-txt` audit even when they are intentional. Check before "fixing" them

## Relevant Skills

- seo-audit
- programmatic-seo
- cro
