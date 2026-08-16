import { test, expect } from '@playwright/test'

/**
 * Sidebar must stay usable when the viewport shrinks.
 * Regression: fixed width without flex-shrink:0 collapsed the panel.
 */

async function open(page: import('@playwright/test').Page) {
  await page.goto('/?zoom=0')
  await expect(page.getByText('SystemischesBrett')).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('sidebar')).toBeVisible()
}

test.describe('Responsive Sidebar', () => {
  test('Sidebar bleibt bei Desktop-Breite sichtbar und nutzbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await open(page)
    const box = await page.getByTestId('sidebar').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(220)
    await expect(page.getByRole('button', { name: '+ Große Figur' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brett leeren' })).toBeVisible()
  })

  test('Sidebar schrumpft nicht unter min-width bei 900px', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 })
    await open(page)
    const box = await page.getByTestId('sidebar').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(200)
    await expect(page.getByRole('button', { name: '+ Würfel' })).toBeVisible()
  })

  test('Sidebar bleibt bei 700px Fensterbreite sichtbar', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 600 })
    await open(page)
    const sidebar = page.getByTestId('sidebar')
    const box = await sidebar.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(180)
    const btn = page.getByRole('button', { name: '+ Kleine Figur' })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })

  test('Sidebar bleibt bei 480px Fensterbreite nutzbar (min ~160px)', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 720 })
    await open(page)
    const box = await page.getByTestId('sidebar').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(150)
    await expect(page.getByRole('button', { name: 'Brett leeren' })).toBeVisible()
  })

  test('Canvas-Pane bleibt neben Sidebar sichtbar', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 })
    await open(page)
    const side = await page.getByTestId('sidebar').boundingBox()
    const pane = await page.getByTestId('canvas-pane').boundingBox()
    expect(side).toBeTruthy()
    expect(pane).toBeTruthy()
    expect(pane!.x).toBeGreaterThanOrEqual(side!.x + side!.width - 2)
    expect(pane!.width).toBeGreaterThan(100)
  })

  test('Resize von groß nach klein behält Sidebar-minWidth', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await open(page)
    let box = await page.getByTestId('sidebar').boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(220)

    await page.setViewportSize({ width: 640, height: 500 })
    await page.waitForTimeout(200)
    box = await page.getByTestId('sidebar').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(160)
    await expect(page.getByTestId('sidebar').getByText('SystemischesBrett')).toBeVisible()
  })

  test('Hohes schmales Fenster: Sidebar scrollbar, Buttons erreichbar', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 400 })
    await open(page)
    const sidebar = page.getByTestId('sidebar')
    const box = await sidebar.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(180)
    await page.getByRole('button', { name: 'Brett leeren' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Brett leeren' })).toBeVisible()
  })
})
