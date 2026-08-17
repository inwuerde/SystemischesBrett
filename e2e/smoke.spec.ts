import { test, expect } from '@playwright/test'
import { openApp, attachDialogHandler, addFigure, saveUnder, selectSaveByName } from './helpers'

/**
 * Schneller Smoke-Pfad: die wichtigsten User-Flows in einem Durchlauf.
 */
test('Smoke: leeren → Figur → Label → speichern → laden → löschen', async ({ page }) => {
  const { messages } = attachDialogHandler(page)
  await openApp(page)

  // 1. Board leeren
  await page.getByRole('button', { name: 'Brett leeren' }).click()

  // 2. Figur hinzufügen & beschriften
  await addFigure(page, 'tall')
  const labelInput = page.locator('label', { hasText: 'Label' }).locator('input')
  await labelInput.fill('Klient')
  await labelInput.press('Enter')
  await expect(labelInput).toHaveValue('Klient')

  // 3. Speicher im Browser
  const name = `Smoke-${Date.now()}`
  await saveUnder(page, name)
  await expect.poll(() => messages.some((m) => m.includes(name))).toBeTruthy()

  // 4. Board leeren und Stand laden
  await page.getByRole('button', { name: 'Brett leeren' }).click()
  await selectSaveByName(page, name)
  await page.getByRole('button', { name: '📂 Laden' }).click()
  await expect(page.locator('canvas')).toBeVisible()

  // 5. Stand löschen
  await selectSaveByName(page, name)
  await page.getByRole('button', { name: '🗑' }).click()
  await expect(page.locator('select').locator('option', { hasText: name })).toHaveCount(0)
})
