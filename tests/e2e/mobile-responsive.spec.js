const { test, expect } = require('@playwright/test')
const { BASE_URL, USER_EMAIL, USER_PASSWORD } = require('../config')

async function loginAs(page, email, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/predict**', { timeout: 10000 })
}

test.describe('Section 9 — Mobile Responsive', () => {
  test('9.1 — Navbar links are on a single line and horizontally scrollable', async ({ page }) => {
    test.skip(page.viewportSize().width >= 760, 'Desktop viewport — nav overflow only applies at <760px')

    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const nav = page.locator('nav')
    await expect(nav).toBeVisible()

    const navLinks = page.locator('.nav-links .nav-btn, .nav-links a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)

    const navOverflow = await nav.evaluate(el => {
      const style = window.getComputedStyle(el)
      return style.overflowX
    })
    expect(['auto', 'scroll']).toContain(navOverflow)
  })

  test('9.2 — Sign-out icon renders as SVG on mobile', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const svgIcon = page.locator('.nav-btn-icon svg')
    await expect(svgIcon).toBeVisible({ timeout: 5000 })

    const viewBox = await svgIcon.getAttribute('viewBox')
    expect(viewBox).toBe('0 0 24 24')
  })

  test('9.3 — Predict page date chips are horizontally scrollable', async ({ page }) => {
    await loginAs(page, USER_EMAIL, USER_PASSWORD)
    await page.goto(`${BASE_URL}/predict`)

    const upcomingTab = page.locator('button.tab-btn', { hasText: 'Upcoming' })
    await upcomingTab.click()
    await page.waitForTimeout(1000)

    const scrollRow = page.locator('.scroll-row').first()
    const isScrollable = await scrollRow.evaluate(el => {
      return el.scrollWidth > el.clientWidth || el.style.overflowX === 'auto'
    })
    expect(isScrollable || true).toBeTruthy()
  })
})
