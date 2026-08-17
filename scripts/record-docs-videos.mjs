/**
 * Records short demo clips of SystemischesBrett for docs/videos.
 * Requires the Vite app on http://127.0.0.1:3000
 */
import { chromium } from '@playwright/test'
import { mkdir, readdir, rm } from 'fs/promises'
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'videos')
const TMP = '/tmp/systemischesbrett-docs-videos'
const BASE = 'http://127.0.0.1:3000'

const wait = (page, ms) => page.waitForTimeout(ms)

async function showTitle(page, title) {
  await page.evaluate((text) => {
    document.getElementById('demo-title')?.remove()
    const el = document.createElement('div')
    el.id = 'demo-title'
    el.textContent = text
    el.style.cssText =
      'position:fixed;top:14px;left:290px;z-index:9999;background:rgba(13,27,42,0.82);color:#fff;padding:8px 14px;border-radius:8px;font:600 20px system-ui,sans-serif;pointer-events:none;letter-spacing:0.01em'
    document.body.appendChild(el)
  }, title)
}

async function openApp(page, query = '?zoom=0') {
  page.on('dialog', async (d) => {
    await d.accept()
  })
  await page.goto(`${BASE}/${query}`)
  await page.getByText('SystemischesBrett').waitFor()
  await page.locator('canvas').waitFor()
  await page.evaluate(() => {
    ;[
      'systemisches-brett-saves-v2',
      'systemisches-brett-saves-v1',
      'systemisches-brett-last-v1',
    ].forEach((k) => localStorage.removeItem(k))
  })
  await page.reload()
  await page.getByText('SystemischesBrett').waitFor()
  await page.locator('canvas').waitFor({ timeout: 15_000 })
  await wait(page, 700)
}

async function setLabel(page, text) {
  const input = page.locator('label', { hasText: 'Label' }).locator('input')
  await input.click()
  await input.fill(text)
  await input.press('Enter')
  await wait(page, 450)
}

async function dragCanvas(page, dx, dy, steps = 22) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('no canvas')
  const x = box.x + box.width * 0.52
  const y = box.y + box.height * 0.48
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps })
  await page.mouse.up()
  await wait(page, 500)
}

async function recordClip(name, title, fn) {
  const dir = path.join(TMP, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: 'de-DE',
    recordVideo: { dir, size: { width: 1400, height: 900 } },
  })
  const page = await context.newPage()
  try {
    await fn(page, title)
    await wait(page, 900)
  } finally {
    await context.close()
    await browser.close()
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith('.webm'))
  if (files.length === 0) throw new Error(`no webm for ${name}`)
  const webm = path.join(dir, files[0])
  const mp4 = path.join(OUT, `${name}.mp4`)
  execFileSync('ffmpeg', [
    '-y',
    '-i', webm,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-crf', '26',
    '-preset', 'medium',
    '-an',
    mp4,
  ], { stdio: 'inherit' })
  console.log('wrote', mp4)
}

await mkdir(OUT, { recursive: true })
await mkdir(TMP, { recursive: true })

await recordClip('01-brett-schlangenlinie', 'Brett und Schlangenlinie', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  await page.getByRole('button', { name: 'Iso' }).click()
  await wait(page, 1100)
  await page.getByRole('button', { name: 'Oben' }).click()
  await wait(page, 1400)
  await page.getByRole('button', { name: 'Seite' }).click()
  await wait(page, 1200)
  await page.getByRole('button', { name: 'Iso' }).click()
  await wait(page, 1000)
})

await recordClip('02-figuren-platzieren', 'Figuren platzieren und beschriften', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  await page.getByRole('button', { name: 'Brett leeren' }).click()
  await wait(page, 400)
  await page.getByRole('button', { name: '+ Große Figur' }).click()
  await setLabel(page, 'Thomas')
  await dragCanvas(page, -160, 40)
  await page.getByRole('button', { name: '+ Mittlere Figur' }).click()
  await setLabel(page, 'Partner')
  await dragCanvas(page, 150, -30)
  await page.getByRole('button', { name: '+ Kleine Figur' }).click()
  await setLabel(page, 'Kind')
  await dragCanvas(page, -40, 90)
  await page.getByRole('button', { name: '+ Würfel' }).click()
  await setLabel(page, 'Thema')
  await page.getByRole('button', { name: 'Iso' }).click()
  await wait(page, 900)
})

await recordClip('03-fokus-und-podest', 'Anklicken, Fokus und Podest', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  await page.getByRole('button', { name: 'Brett leeren' }).click()
  await page.getByRole('button', { name: '+ Große Figur' }).click()
  await setLabel(page, 'Ich')
  await wait(page, 800)
  await page.getByRole('checkbox').check()
  await wait(page, 1200)
  await page.getByRole('button', { name: '+ Würfel' }).click()
  await wait(page, 900)
  await page.getByRole('checkbox').check()
  await wait(page, 1100)
})

await recordClip('04-spielfeld-trennen', 'Spielfeld trennen und zusammenführen', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  await page.getByRole('button', { name: 'Iso' }).click()
  await wait(page, 700)
  await page.getByRole('button', { name: 'Spielfeld trennen' }).click()
  await wait(page, 1600)
  await page.getByRole('button', { name: 'Spielfeld zusammenführen' }).click()
  await wait(page, 1200)
})

await recordClip('05-kamera', 'Kamera-Presets', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  for (const name of ['Iso', 'Oben', 'Seite', 'Front', 'Iso']) {
    await page.getByRole('button', { name }).click()
    await wait(page, 950)
  }
})

await recordClip('06-speichern-laden', 'Speicher im Browser und laden', async (page, title) => {
  await openApp(page)
  await showTitle(page, title)
  await page.getByRole('button', { name: 'Brett leeren' }).click()
  await page.getByRole('button', { name: '+ Große Figur' }).click()
  await setLabel(page, 'Klient')
  await page.getByPlaceholder('Dateiname / Bezeichnung…').fill('Familienaufstellung')
  await wait(page, 500)
  await page.getByRole('button', { name: '💾 Speicher im Browser' }).click()
  await wait(page, 700)
  await page.getByRole('button', { name: '📄 Neue Version' }).click()
  await wait(page, 700)
  await page.getByRole('button', { name: 'Brett leeren' }).click()
  await wait(page, 700)
  const select = page.locator('select')
  const opt = select.locator('option').filter({ hasText: 'Familienaufstellung' }).first()
  const value = await opt.getAttribute('value')
  await select.selectOption(value)
  await wait(page, 400)
  await page.getByRole('button', { name: '📂 Laden' }).click()
  await wait(page, 1100)
})

await recordClip('07-zoom-app', 'Zoom App (Demo)', async (page, title) => {
  await openApp(page, '?zoom=1')
  await showTitle(page, title)
  await page.getByTestId('zoom-status').waitFor({ timeout: 10_000 })
  await wait(page, 800)
  await page.getByTestId('zoom-share').click()
  await wait(page, 600)
  await page.getByTestId('zoom-expand').click()
  await wait(page, 600)
  await page.getByTestId('zoom-sync').click()
  await wait(page, 1000)
})

console.log('all clips ready in', OUT)
