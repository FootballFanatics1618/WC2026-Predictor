const { test, expect } = require('@playwright/test')
const { BASE_URL, USER_EMAIL, USER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } = require('../config')

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/predict**', { timeout: 10000 })
}

test.describe('Section 6 — UI Features', () => {
  test('6.1 — Predict page renders match cards with prediction status', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const tabs = page.locator('.tab-btn')
    await expect(tabs.first()).toBeVisible({ timeout: 5000 })
    expect(await tabs.count()).toBe(3)

    const upcomingTab = page.locator('button.tab-btn', { hasText: 'Upcoming' })
    await upcomingTab.click()
    await page.waitForTimeout(1000)

    const matchCards = page.locator('.match-card')
    await expect(matchCards.first()).toBeVisible({ timeout: 5000 })

    const teamText = page.locator('.match-teams, .match-card span')
    expect(await teamText.count()).toBeGreaterThan(0)
  })

  test('6.4a — Admin link IS visible for admin user', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const adminLink = page.locator('a[href="/admin"]')
    await expect(adminLink).toBeVisible({ timeout: 5000 })
  })

  test('6.4b — Admin link is NOT visible for regular user', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const adminLink = page.locator('a[href="/admin"]')
    await expect(adminLink).not.toBeVisible({ timeout: 3000 })
  })

  test('6.4c — Non-admin visiting /admin sees "No admin access"', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/admin`)

    const noAccess = page.locator('text=No admin access')
    await expect(noAccess).toBeVisible({ timeout: 5000 })
  })
})
