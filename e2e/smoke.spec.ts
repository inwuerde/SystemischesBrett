import { test, expect } from '@playwright/test'
import { openApp, addFigure, saveUnder, selectSaveByName, clearBoard, expectNotice } from './helpers'

/**
 * Schneller Smoke-Pfad: die wichtigsten User-Flows in einem Durchlauf.
 */
test('Smoke: leeren → Figur → Label → speichern → laden → löschen', async ({ page }) => {
  await openApp(page)

  // 1. Board leeren
  await clearBoard(page)

  // 2. Figur hinzufügen & beschriften
  await addFigure(page, 'tall')
  const labelInput = page.locator('label', { hasText: 'Label' }).locator('input')
  await labelInput.fill('Klient')
  await labelInput.press('Enter')
  await expect(labelInput).toHaveValue('Klient')

  // 3. Speicher im Browser
  const name = `Smoke-${Date.now()}`
  await saveUnder(page, name)
  await expectNotice(page, name)

  // 4. Board leeren und Stand laden
  await clearBoard(page)
  await selectSaveByName(page, name)
  await page.getByRole('button', { name: '📂 Laden' }).click()
  await expect(page.locator('canvas')).toBeVisible()

  // 5. Stand löschen
  await selectSaveByName(page, name)
  await page.getByRole('button', { name: '🗑' }).click()
  await expect(page.locator('select').locator('option', { hasText: name })).toHaveCount(0)
})
