import { Page, expect, Dialog } from '@playwright/test'

/** Accept all native dialogs (alert/confirm) and capture their messages. */
export function attachDialogHandler(page: Page): { messages: string[] } {
  const messages: string[] = []
  page.on('dialog', async (dialog: Dialog) => {
    messages.push(dialog.message())
    await dialog.accept()
  })
  return { messages }
}

/** Clear app localStorage keys used by SystemischesBrett. */
export async function clearAppStorage(page: Page) {
  await page.evaluate(() => {
    const keys = [
      'systemisches-brett-saves-v2',
      'systemisches-brett-saves-v1',
      'systemisches-brett-last-v1',
      'systemisches-brett-v2',
      'systemisches-brett-v1',
    ]
    keys.forEach((k) => localStorage.removeItem(k))
  })
}

/** Navigate to app with clean storage. */
export async function openApp(page: Page) {
  await page.goto('/')
  await clearAppStorage(page)
  await page.reload()
  await expect(page.getByText('SystemischesBrett')).toBeVisible()
  // WebGL canvas should be present
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })
}

export async function addFigure(page: Page, type: 'tall' | 'medium' | 'small' | 'cube' | 'disc') {
  const labels: Record<typeof type, string> = {
    tall: '+ Große Figur',
    medium: '+ Mittlere Figur',
    small: '+ Kleine Figur',
    cube: '+ Würfel',
    disc: '+ Scheibe',
  }
  await page.getByRole('button', { name: labels[type] }).click()
  // Selection panel appears for newly added figure
  await expect(page.getByText('Ausgewählt')).toBeVisible()
}

export async function saveUnder(page: Page, name: string) {
  await page.getByPlaceholder('Dateiname / Bezeichnung…').fill(name)
  await page.getByRole('button', { name: '💾 Speicher im Browser' }).click()
}

/** Select a saved board option by name substring. */
export async function selectSaveByName(page: Page, name: string) {
  const select = page.locator('select')
  const option = select.locator('option').filter({ hasText: name }).first()
  await expect(option).toHaveCount(1)
  const value = await option.getAttribute('value')
  if (!value) throw new Error(`No value for save option matching ${name}`)
  await select.selectOption(value)
}
