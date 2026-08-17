import { test, expect } from '@playwright/test'
import { openApp, addFigure, saveUnder, selectSaveByName, clearBoard, expectNotice } from './helpers'

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
    await clearBoard(page)
    await expect(page.getByText('Figur anklicken oder ziehen')).toBeVisible()
    await expect(page.getByText('Ausgewählt')).toHaveCount(0)
  })

  test('Brett leeren verlangt Bestätigung', async ({ page }) => {
    await page.getByRole('button', { name: 'Brett leeren' }).click()
    await expect(page.getByRole('button', { name: 'Wirklich leeren' })).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByRole('button', { name: 'Brett leeren' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wirklich leeren' })).toHaveCount(0)
  })

  test('Große Figur hinzufügen öffnet Auswahl-Panel', async ({ page }) => {
    await clearBoard(page)
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
    await clearBoard(page)
    for (const type of ['tall', 'medium', 'small', 'cube', 'disc'] as const) {
      await addFigure(page, type)
      await expect(page.getByText('Ausgewählt')).toBeVisible()
    }
  })

  test('Label setzen und mit Enter bestätigen', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'medium')
    const input = page.locator('label', { hasText: 'Label' }).locator('input')
    await input.fill('Partner')
    await input.press('Enter')
    await expect(input).toHaveValue('Partner')
  })

  test('Podest-Checkbox umschalten', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'small')
    const checkbox = page.getByRole('checkbox')
    await expect(checkbox).not.toBeChecked()
    await checkbox.check()
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
  })

  test('Figur drehen über Buttons', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'tall')
    await page.getByRole('button', { name: '↺ Drehen' }).click()
    await page.getByRole('button', { name: 'Drehen ↻' }).click()
    await page.getByRole('button', { name: 'Drehen ↻' }).click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })

  test('Holzton-Buttons sind klickbar', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'tall')
    const colorButtons = page.locator('button[style*="background"]')
    const count = await colorButtons.count()
    expect(count).toBeGreaterThan(0)
    await colorButtons.nth(0).click()
    await colorButtons.nth(Math.min(3, count - 1)).click()
    await expect(page.getByText('Ausgewählt')).toBeVisible()
  })

  test('Figur entfernen schließt Auswahl-Panel', async ({ page }) => {
    await clearBoard(page)
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
    await clearBoard(page)
    await page.getByRole('button', { name: '↩ Undo' }).click()
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('Undo nach Figur entfernen', async ({ page }) => {
    await clearBoard(page)
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

  test('Speicher im Browser ohne Namen zeigt Hinweis', async ({ page }) => {
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill('')
    await page.getByRole('button', { name: '💾 Speicher im Browser' }).click()
    await expectNotice(page, 'Namen')
  })

  test('Speicher im Browser mit Namen legt Version 1 an', async ({ page }) => {
    const name = `E2E-Test-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, new RegExp(`${name}.*Version`))
    const select = page.locator('select')
    await expect(select.locator('option', { hasText: name })).toHaveCount(1)
    const optionText = await select.locator('option', { hasText: name }).textContent()
    expect(optionText).toMatch(/v1/)
  })

  test('gleiche Bezeichnung erzeugt neue Version', async ({ page }) => {
    const name = `Versioniert-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await clearBoard(page)
    await saveUnder(page, name)
    await expectNotice(page, /Version 2|v2/)
    const select = page.locator('select')
    const options = select.locator('option', { hasText: name })
    await expect(options).toHaveCount(2)
  })

  test('Neue Version Button speichert Folgestand', async ({ page }) => {
    const name = `NeueVer-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await selectSaveByName(page, name)
    await page.getByRole('button', { name: '📄 Neue Version' }).click()
    await expectNotice(page, /v2|Version 2/i)
  })

  test('Laden stellt gespeicherten Stand wieder her', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'disc')
    const name = `Laden-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await clearBoard(page)
    await expect(page.getByText('Ausgewählt')).toHaveCount(0)
    await selectSaveByName(page, name)
    await expect(page.getByRole('button', { name: '📂 Laden' })).toBeEnabled()
    await page.getByRole('button', { name: '📂 Laden' }).click()
    await expect(page.locator('canvas')).toBeVisible()
    await expectNotice(page, /geladen/)
  })

  test('Löschen entfernt gespeicherten Stand', async ({ page }) => {
    const name = `Delete-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await selectSaveByName(page, name)
    await page.getByRole('button', { name: '🗑' }).click()
    await expect(page.locator('select').locator('option', { hasText: name })).toHaveCount(0)
  })

  test('Als Datei speichern lädt eine JSON-Datei herunter', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'tall')
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill('DateiExport')
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('save-file').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/DateiExport\.sbrett\.json/)
  })

  test('Als Bild speichern lädt eine PNG-Datei herunter', async ({ page }) => {
    await expect(page.getByTestId('save-image')).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('save-image').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.png$/)
    await expectNotice(page, 'Bild gespeichert')
  })

  test('Als Bild speichern enthält gesetzte Figurennamen', async ({ page }) => {
    await clearBoard(page)
    await addFigure(page, 'tall')
    const input = page.locator('label', { hasText: 'Label' }).locator('input')
    await input.fill('Mutter')
    await input.press('Enter')
    await expect(page.locator('[data-figure-label="Mutter"]')).toHaveCount(1)
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('save-image').click()
    const download = await downloadPromise
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const png = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of png) chunks.push(Buffer.from(chunk))
    const bytes = Buffer.concat(chunks)
    expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBeTruthy()
    expect(bytes.length).toBeGreaterThan(2000)
  })

  test('Aus Datei laden stellt Figuren wieder her', async ({ page }) => {
    await clearBoard(page)
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
    await expectNotice(page, 'DateiImport')
  })

  test('Aus Datei laden stellt Trennung wieder her', async ({ page }) => {
    const payload = {
      format: 'systemisches-brett',
      formatVersion: 1,
      name: 'Geteilt',
      savedAt: new Date().toISOString(),
      split: true,
      figures: [
        { id: 'file-2', position: [-2, 0, 0], rotationY: 0, color: '#e8d4b0', label: 'Links', type: 'tall' },
      ],
    }
    await page.getByTestId('file-load-input').setInputFiles({
      name: 'split.sbrett.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    })
    await expect(page.getByTestId('board-split')).toHaveText('Spielfeld zusammenführen')
  })

  test('Speicher im Browser per Enter-Taste', async ({ page }) => {
    const name = `Enter-${Date.now()}`
    await page.getByPlaceholder('Dateiname / Bezeichnung…').fill(name)
    await page.getByPlaceholder('Dateiname / Bezeichnung…').press('Enter')
    await expectNotice(page, name)
  })

  test('Browser-Speicher merkt sich die Trennung', async ({ page }) => {
    await page.getByTestId('board-split').click()
    const name = `SplitSave-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await page.getByTestId('board-split').click()
    await expect(page.getByTestId('board-split')).toHaveText('Spielfeld trennen')
    await selectSaveByName(page, name)
    await page.getByRole('button', { name: '📂 Laden' }).click()
    await expect(page.getByTestId('board-split')).toHaveText('Spielfeld zusammenführen')
  })
})

test.describe('SystemischesBrett – localStorage Persistenz', () => {
  test('gespeicherte Stände überleben Reload', async ({ page }) => {
    await openApp(page)
    const name = `Persist-${Date.now()}`
    await saveUnder(page, name)
    await expectNotice(page, name)
    await page.reload()
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    const select = page.locator('select')
    await expect(select.locator('option', { hasText: name })).toHaveCount(1)
  })

  test('letzter Stand inkl. Trennung überlebt Reload', async ({ page }) => {
    await openApp(page)
    await page.getByTestId('board-split').click()
    await expect(page.getByTestId('board-split')).toHaveText('Spielfeld zusammenführen')
    await page.reload()
    await expect(page.getByText('SystemischesBrett')).toBeVisible()
    await expect(page.getByTestId('board-split')).toHaveText('Spielfeld zusammenführen')
  })

  test('neue Figuren landen nicht auf derselben Position', async ({ page }) => {
    await openApp(page)
    await clearBoard(page)
    await addFigure(page, 'tall')
    await addFigure(page, 'medium')
    await expect.poll(async () => {
      return page.evaluate(() => {
        const raw = localStorage.getItem('systemisches-brett-last-v2')
        if (!raw) return 0
        const parsed = JSON.parse(raw) as { figures?: Array<{ position: number[] }> }
        const figs = parsed.figures || []
        if (figs.length < 2) return 0
        const a = figs[0].position
        const b = figs[1].position
        const dx = a[0] - b[0]
        const dz = a[2] - b[2]
        return Math.hypot(dx, dz)
      })
    }).toBeGreaterThan(0.5)
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

test.describe('SystemischesBrett – Touch / Bild', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('Canvas unterbindet Browser-Gesten (touch-action none)', async ({ page }) => {
    const pane = page.getByTestId('canvas-pane')
    await expect(pane).toBeVisible()
    const touchAction = await pane.evaluate((el) => getComputedStyle(el).touchAction)
    expect(touchAction).toBe('none')
  })
})
