import { test, expect } from '@playwright/test'
import { openApp, attachDialogHandler } from './helpers'

/**
 * Zoom App mode is simulated via ?zoom=1 (see src/zoom/zoomClient.ts).
 * Standalone forced via ?zoom=0.
 */

test.describe('Zoom App – Standalone', () => {
  test('zeigt Standalone-Status ohne Zoom-Buttons', async ({ page }) => {
    await page.goto('/?zoom=0')
    await page.evaluate(() => {
      ;['systemisches-brett-saves-v2', 'systemisches-brett-last-v1'].forEach((k) =>
        localStorage.removeItem(k)
      )
    })
    await page.reload()
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })

    const status = page.getByTestId('zoom-status')
    await expect(status).toBeVisible({ timeout: 10_000 })
    await expect(status).toContainText('Standalone')
    await expect(page.getByTestId('zoom-share')).toHaveCount(0)
  })
})

test.describe('Zoom App – Simulated in-meeting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?zoom=1')
    await page.evaluate(() => {
      ;['systemisches-brett-saves-v2', 'systemisches-brett-last-v1'].forEach((k) =>
        localStorage.removeItem(k)
      )
    })
    await page.reload()
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
  })

  test('zeigt Zoom-Status mit Meeting-Kontext', async ({ page }) => {
    const status = page.getByTestId('zoom-status')
    await expect(status).toBeVisible({ timeout: 10_000 })
    await expect(status).toContainText('Zoom App')
    await expect(status).toContainText('inMeeting')
    await expect(status).toContainText('Demo Moderator')
    await expect(status).toContainText('Systemische Aufstellung')
  })

  test('Zoom-Aktionsbuttons sind sichtbar und klickbar', async ({ page }) => {
    await expect(page.getByTestId('zoom-share')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('zoom-expand')).toBeVisible()
    await expect(page.getByTestId('zoom-sync')).toBeVisible()

    await page.getByTestId('zoom-share').click()
    await page.getByTestId('zoom-expand').click()
    await page.getByTestId('zoom-sync').click()
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Brett-Funktionen bleiben in Zoom-Modus nutzbar', async ({ page }) => {
    attachDialogHandler(page)
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await page.getByRole('button', { name: '+ Große Figur' }).click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
    await page.getByTestId('zoom-sync').click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })
})

test.describe('Zoom App – Default (ohne Query)', () => {
  test('lädt ohne Fehler und zeigt Status-Badge', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('zoom-status')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('zoom-status')).toContainText(/Standalone|Zoom/i)
  })
})
