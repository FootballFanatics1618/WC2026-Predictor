const { test, expect } = require('@playwright/test')
const { BASE_URL } = require('../config')

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/predict**', { timeout: 10000 })
}

test.describe('Section 8 — Others Page', () => {
  test('8.1 — Others page loads and shows matches', async ({ page }) => {
    await loginAs(page, 'achintyakarapurkar@gmail.com', 'worldcup2026')
    await page.goto(`${BASE_URL}/others`)

    await page.waitForTimeout(2000)

    // Others page renders dates as <button> elements (no .card class)
    const dateButtons = page.locator('.page button')
    const count = await dateButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('8.2 — Others page groups predictions by match date', async ({ page }) => {
    await loginAs(page, 'achintyakarapurkar@gmail.com', 'worldcup2026')
    await page.goto(`${BASE_URL}/others`)

    await page.waitForTimeout(2000)

    // Click a date to enter the date detail view where stage labels appear
    const firstDate = page.locator('.page button').first()
    await firstDate.click()
    await page.waitForTimeout(1000)

    const stageLabels = page.locator('text=/Group Stage|Round of/')
    const count = await stageLabels.count()
    expect(count).toBeGreaterThan(0)

    const vsLabels = page.locator('text=vs')
    const vsCount = await vsLabels.count()
    expect(vsCount).toBeGreaterThan(0)
  })
})
