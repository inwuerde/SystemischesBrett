import { test, expect } from '@playwright/test'

/**
 * Lightweight checks of Zoom client module behavior via page.evaluate
 * (no real Zoom client required).
 */

test.describe('Zoom client module', () => {
  test('initZoomApp standalone via ?zoom=0', async ({ page }) => {
    await page.goto('/?zoom=0')
    await page.waitForSelector('canvas', { timeout: 15_000 })

    const text = await page.getByTestId('zoom-status').innerText()
    expect(text).toMatch(/Standalone/i)
    expect(text).not.toMatch(/inMeeting/)
  })

  test('initZoomApp demo meeting via ?zoom=1', async ({ page }) => {
    await page.goto('/?zoom=1')
    await page.waitForSelector('[data-testid="zoom-status"]', { timeout: 15_000 })
    const text = await page.getByTestId('zoom-status').innerText()
    expect(text).toMatch(/Zoom App/i)
    expect(text).toMatch(/inMeeting/)
    expect(text).toMatch(/Demo Moderator/)
  })

  test('ZOOM_CAPABILITIES export is available through app bundle', async ({ page }) => {
    await page.goto('/?zoom=1')
    await page.waitForSelector('[data-testid="zoom-share"]', { timeout: 15_000 })
    await expect(page.getByTestId('zoom-share')).toBeEnabled()
    await expect(page.getByTestId('zoom-expand')).toBeEnabled()
    await expect(page.getByTestId('zoom-sync')).toBeEnabled()
  })
})
