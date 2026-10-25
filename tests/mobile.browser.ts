import { test, expect } from '@playwright/test'
import { expectReveal, openTitle, startStory } from './helpers'

// OWNER: Brief M (Mobile and small-laptop layout)

test.describe('Mobile layout (390x844)', () => {
  test('no horizontal scroll; HUD, 5 buildings and control bar visible; tapping opens dialogs; advances and finishes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile layout test runs on mobile project only')

    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))

    await openTitle(page)

    // Verify title has no horizontal overflow
    const titleScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(titleScrollWidth).toBeLessThanOrEqual(viewportWidth)

    await startStory(page, 'College Student')

    // 1. No horizontal scroll on town
    const townScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(townScrollWidth).toBeLessThanOrEqual(viewportWidth)

    const viewportHeight = await page.evaluate(() => window.innerHeight)

    // 2. HUD, five buildings and control bar all visible without scrolling
    const hud = page.getByRole('region', { name: 'Financial overview' })
    await expect(hud).toBeVisible()
    const hudBox = await hud.boundingBox()
    expect(hudBox).not.toBeNull()
    expect(hudBox!.y).toBeGreaterThanOrEqual(0)
    expect(hudBox!.y + hudBox!.height).toBeLessThan(viewportHeight)

    const controlBar = page.getByRole('group', { name: 'Time controls' })
    await expect(controlBar).toBeVisible()
    const controlBarBox = await controlBar.boundingBox()
    expect(controlBarBox).not.toBeNull()
    expect(controlBarBox!.y).toBeGreaterThan(hudBox!.y + hudBox!.height)
    expect(controlBarBox!.y + controlBarBox!.height).toBeLessThanOrEqual(viewportHeight)

    const buildings = [
      { id: 'bank', name: 'Pine Bank' },
      { id: 'office', 'name': 'Town Office' },
      { id: 'hospital', name: 'Health House' },
      { id: 'home', name: 'Your Home' },
      { id: 'market', name: 'Market Hall' },
    ]

    for (const b of buildings) {
      const button = page.getByRole('button', { name: new RegExp(`^Open ${b.name}:`) })
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      // Buildings should be in the visible area between HUD and control bar
      expect(box!.y).toBeGreaterThanOrEqual(hudBox!.y + hudBox!.height - 10)
      expect(box!.y + box!.height).toBeLessThanOrEqual(controlBarBox!.y + 10)

      // 3. Tapping each building opens its dialog
      await button.click()
      const dialog = page.getByRole('dialog', { name: b.name })
      await expect(dialog).toBeVisible()

      // Close the dialog
      await page.getByRole('button', { name: 'Close panel' }).click()
      await expect(dialog).toHaveCount(0)
    }

    // 4. Next month advances
    await expect(page.getByText('Month 0 / 24')).toBeVisible()
    await page.getByRole('button', { name: /Next month/ }).click()
    await expect(page.getByText(/^Month 1 \/ \d+$/)).toBeVisible()

    // 5. Finish -> reveal reachable
    await page.getByRole('button', { name: /Finish & reveal/ }).click()
    await expectReveal(page)

    expect(errors).toEqual([])
  })
})

test.describe('Small laptop layout (1280x720)', () => {
  test('Pine Bank window fits between HUD and control bar at 1280x720', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop only')
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.route('**/api/ai', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
    await openTitle(page)
    await startStory(page, 'Entry-Level Worker')

    const hud = page.getByRole('region', { name: 'Financial overview' })
    const controlBar = page.getByRole('group', { name: 'Time controls' })
    await expect(hud).toBeVisible()
    await expect(controlBar).toBeVisible()

    const hudBox = (await hud.boundingBox())!
    const controlBarBox = (await controlBar.boundingBox())!

    // Open Pine Bank
    await page.getByRole('button', { name: /Open Pine Bank:/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Pine Bank' })
    await expect(dialog).toBeVisible()

    const dialogBox = (await dialog.boundingBox())!

    // Assert Pine Bank window fits between HUD and control bar
    expect(dialogBox.y).toBeGreaterThanOrEqual(hudBox.y + hudBox.height)
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(controlBarBox.y)

    // Body scrolls inside if needed; header remains visible
    await expect(dialog.getByRole('heading', { name: 'Pine Bank' })).toBeVisible()

    await page.getByRole('button', { name: 'Close panel' }).click()
    await expect(dialog).toHaveCount(0)
  })
})
