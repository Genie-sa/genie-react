import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/og.png')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: center; padding: 96px;
    background: radial-gradient(1200px 800px at 85% -10%, #1e3a5f 0%, #0b1220 55%, #070b14 100%);
    font-family: -apple-system, "SF Pro Display", "Segoe UI", sans-serif; color: #f8fafc;
  }
  .kicker { font-family: "SF Mono", ui-monospace, monospace; font-size: 26px; color: #7dd3fc; letter-spacing: 0.04em; }
  h1 { font-size: 96px; font-weight: 650; letter-spacing: -0.02em; margin-top: 28px; }
  p { font-size: 36px; line-height: 1.4; color: #94a3b8; margin-top: 28px; max-width: 900px; }
  .domain { position: absolute; bottom: 64px; left: 96px; font-family: "SF Mono", ui-monospace, monospace; font-size: 28px; color: #64748b; }
</style></head>
<body>
  <div class="kicker">Live app evidence for agents</div>
  <h1>Genie React</h1>
  <p>Live React &amp; TanStack DevTools for AI coding agents — see what React did, find the cause, check the result.</p>
  <div class="domain">genie-react.com</div>
</body></html>`

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: outputPath })
await browser.close()
console.log(`Wrote ${outputPath}`)
