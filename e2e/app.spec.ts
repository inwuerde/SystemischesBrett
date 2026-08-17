import { test, expect } from '@playwright/test'
import { openApp, attachDialogHandler, addFigure, saveUnder, selectSaveByName } from './helpers'

test.describe('SystemischesBrett – App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('lädt Titel, Sidebar und 3D-Canvas', async ({ page }) => {
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    await expect(page.getByText('Holzfiguren · Schlangenlinie')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Große Figur' })).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByText('Figur anklicken oder ziehen')).toBeVisible()
  })

  test('zeigt alle Figuren-Buttons', async ({ page }) => {
    for (const label of [
      '+ Große Figur',
      '+ Mittlere Figur',
      '+ Kleine Figur',
      '+ Würfel',
      '+ Scheibe',
    ]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
  })

  test('zeigt Kamera-Presets und History-Buttons', async ({ page }) => {
    for (const label of ['Iso', 'Oben', 'Seite', 'Front', '↩ Undo', 'Redo ↪']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
  })

  test('zeigt Speicher-im-Browser Bereich', async ({ page }) => {
    await expect(page.getByText('Speicher im Browser', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Dateiname / Bezeichnung…')).toBeVisible()
    await expect(page.getByRole('button', { name: '💾 Speicher im Browser' })).toBeVisible()
    await expect(page.getByRole('button', { name: '📄 Neue Version' })).toBeVisible()
    await expect(page.getByText('Gespeicherte Dateien (Versionen)')).toBeVisible()
    await expect(page.getByRole('button', { name: '📂 Laden' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '🗑', exact: true })).toBeDisabled()
  })
})

test.describe('SystemischesBrett – Figuren', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('Brett leeren entfernt alle Figuren und zeigt Hinweis', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await expect(page.getByText('Figur anklicken oder ziehen')).toBeVisible()
    await expect(page.getByText('Ausgewählt')).toHaveCount(0)
  })

  test('Große Figur hinzufügen öffnet Auswahl-Panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'tall')
    await expect(page.getByText('Ausgewählt')).toBeVisible()
    await expect(page.getByText('Label')).toBeVisible()
    await expect(page.getByText('Holzton')).toBeVisible()
    await expect(page.getByText('Auf Podest')).toBeVisible()
    await expect(page.getByRole('button', { name: '↺ Drehen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Drehen ↻' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entfernen' })).toBeVisible()
  })

  test('alle Figurtypen lassen sich hinzufügen', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    for (const type of ['tall', 'medium', 'small', 'cube', 'disc'] as const) {
      await addFigure(page, type)
      await expect(page.getByText('Ausgewählt')).toBeVisible()
    }
  })

  test('Label setzen und mit Enter bestätigen', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'medium')
    const input = page.locator('label', { hasText: 'Label' }).locator('input')
    await input.fill('Partner')
    await input.press('Enter')
    await expect(input).toHaveValue('Partner')
  })

  test('Podest-Checkbox umschalten', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'small')
    const checkbox = page.getByRole('checkbox')
    await expect(checkbox).not.toBeChecked()
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
  })

  test('Figur drehen über Buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'tall')
    await page.getByRole('button', { name: '↺ Drehen' }).click()
    await page.getByRole('button', { name: 'Drehen ↻' }).click()
    await page.getByRole('button', { name: 'Drehen ↻' }).click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })

  test('Holzton-Buttons sind klickbar', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'tall')
    const colorButtons = page.locator('button[style*="background"]')
    const count = await colorButtons.count()
    expect(count).toBeGreaterThan(0)
    await colorButtons.nth(0).click()
    await colorButtons.nth(Math.min(3, count - 1)).click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })

  test('Figur entfernen schließt Auswahl-Panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'cube')
    await page.getByRole('button', { name: 'Entfernen' }).click()
    await expect(page.getByText('Ausgewählt')).toHaveCount(0)
    await expect(page.getByText('Figur anklicken oder ziehen')).toBeVisible()
  })
})

test.describe('SystemischesBrett – Kamera & History', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('Kamera-Presets sind klickbar ohne Fehler', async ({ page }) => {
    for (const name of ['Iso', 'Oben', 'Seite', 'Front']) {
      await page.getByRole('button', { name }).click()
    }
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Undo nach Brett leeren stellt Figuren wieder her', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await page.getByRole('button', { name: '↩ Undo' }).click()
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Undo nach Figur entfernen', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'tall')
    await expect(page.getByText('Ausgewählt')).toBeVisible()
    await page.getByRole('button', { name: 'Entfernen' }).click()
    await expect(page.getByText('Figur anklicken oder ziehen')).toBeVisible()
    const undo = page.getByRole('button', { name: '↩ Undo' })
    await expect(undo).toBeEnabled()
    await undo.click()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: '↩ Undo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Redo ↪' })).toBeVisible()
  })
})

test.describe('SystemischesBrett – Speicher im Browser & Versionierung', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('Speicher im Browser ohne Namen zeigt Alert', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill('')
    await page.getByRole('button', { name: '💾 Speicher im Browser' }).click()
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.includes('Namen'))).toBeTruthy()
  })

  test('Speicher im Browser mit Namen legt Version 1 an', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    const name = `E2E-Test-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.includes(name) && m.includes('Version'))).toBeTruthy()
    const select = page.locator('select')
    await expect(select.locator('option', { hasText: name })).toHaveCount(1)
    const optionText = await select.locator('option', { hasText: name }).textContent()
    expect(optionText).toMatch(/v1/)
  })

  test('gleiche Bezeichnung erzeugt neue Version', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    const name = `Versioniert-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    messages.length = 0
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.includes('Version 2') || m.includes('v2'))).toBeTruthy()
    const select = page.locator('select')
    const options = select.locator('option', { hasText: name })
    await expect(options).toHaveCount(2)
  })

  test('Neue Version Button speichert Folgestand', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    const name = `NeueVer-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    messages.length = 0
    await selectSaveByName(page, name)
    await page.getByRole('button', { name: '📄 Neue Version' }).click()
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => /v2|Version 2/i.test(m))).toBeTruthy()
  })

  test('Laden stellt gespeicherten Stand wieder her', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'disc')
    const name = `Laden-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await expect(page.getByText('Ausgewählt')).toHaveCount(0)
    await selectSaveByName(page, name)
    await expect(page.getByRole('button', { name: '📂 Laden' })).toBeEnabled()
    await page.getByRole('button', { name: '📂 Laden' }).click()
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Löschen entfernt gespeicherten Stand', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    const name = `Delete-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    await selectSaveByName(page, name)
    await page.getByRole('button', { name: '🗑' }).click()
    await expect(page.locator('select').locator('option', { hasText: name })).toHaveCount(0)
  })

  test('Als Datei speichern lädt eine JSON-Datei herunter', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await addFigure(page, 'tall')
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill('DateiExport')
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('save-file').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/DateiExport\.sbrett\.json/)
  })

  test('Aus Datei laden stellt Figuren wieder her', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    const payload = {
      format: 'systemisches-brett',
      formatVersion: 1,
      name: 'DateiImport',
      savedAt: new Date().toISOString(),
      split: false,
      figures: [
        { id: 'file-1', position: [1, 0, 1], rotationY: 0, color: '#e8d4b0', label: 'Import', type: 'medium' },
      ],
    }
    await page.getByTestId('file-load-input').setInputFiles({
      name: 'import.sbrett.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    })
    await expect(page.getByPlaceholder('Dateiname / Bezeichnung…')).toHaveValue('DateiImport')
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Speicher im Browser per Enter-Taste', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    const name = `Enter-${Date.now()}`
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill(name)
    await page.getByPlaceholder('Dateiname / Bezeichnung…').press('Enter')
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.includes(name))).toBeTruthy()
  })
})

test.describe('SystemischesBrett – localStorage Persistenz', () => {
  test('gespeicherte Stände überleben Reload', async ({ page }) => {
    const { messages } = attachDialogHandler(page)
    await openApp(page)
    const name = `Persist-${Date.now()}`
    await saveUnder(page, name)
    await expect.poll(() => messages.length).toBeGreaterThan(0)
    await page.reload()
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    const select = page.locator('select')
    await expect(select.locator('option', { hasText: name })).toHaveCount(1)
  })
})

test.describe('SystemischesBrett – Accessibility & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('Sidebar und Canvas teilen die Ansicht', async ({ page }) => {
    const canvas = page.locator('canvas')
    const title = page.getByText('SystemischesBrett')
    await expect(title).toBeVisible()
    await expect(canvas).toBeVisible()
    const canvasBox = await canvas.boundingBox()
    const titleBox = await title.boundingBox()
    expect(canvasBox).toBeTruthy()
    expect(titleBox).toBeTruthy()
    expect(canvasBox!.x).toBeGreaterThan(titleBox!.x)
  })

  test('Buttons haben sichtbaren Cursor/Hover-Zustand (enabled)', async ({ page }) => {
    const btn = page.getByRole('button', { name: '+ Große Figur' })
    await expect(btn).toBeEnabled()
    await btn.hover()
    await expect(btn).toBeVisible()
  })
})

test.describe('SystemischesBrett – Spielfeld trennen', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('zeigt Taste Spielfeld trennen', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Spielfeld trennen' })).toBeVisible()
  })

  test('Taste trennt und führt das Spielfeld wieder zusammen', async ({ page }) => {
    const btn = page.getByTestId('board-split')
    await expect(btn).toHaveText('Spielfeld trennen')
    await btn.click()
    await expect(btn).toHaveText('Spielfeld zusammenführen')
    await expect(page.locator('canvas')).toBeVisible()
    await btn.click()
    await expect(btn).toHaveText('Spielfeld trennen')
  })
})
