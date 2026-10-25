import { test, expect } from '@playwright/test'
import { openTitle, startStory } from './helpers'

// OWNER: Agent 1 (world). The town stage at laptop sizes: integer zoom, no page scroll, art loaded, hover and keyboard.

for (const [width, height, px] of [[1280, 720, 4], [1366, 768, 4], [1440, 900, 4], [1920, 1080, 6]] as const) {
  test(`town world fits ${width}x${height} at ${px}x zoom`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'laptop sizes only')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height })
    await openTitle(page)
    await startStory(page, 'College Student')
    await expect(page.locator('.fv-stage')).toHaveAttribute('data-px', String(px))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true)

    const art = await page.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll<HTMLElement>('.fv-sprite')].map((e) => getComputedStyle(e).backgroundImage))]
      const ok = await Promise.all(urls.map((u) => new Promise<boolean>((resolve) => {
        const m = /url\("?([^")]+)"?\)/.exec(u)
        if (!m) return resolve(false)
        const img = new Image()
        img.onload = () => resolve(img.naturalWidth > 0)
        img.onerror = () => resolve(false)
        img.src = m[1]!
      })))
      return { count: urls.length, allLoaded: ok.every(Boolean) }
    })
    expect(art.count).toBeGreaterThan(8)
    expect(art.allLoaded).toBe(true)

    if (width === 1280 || width === 1440) await page.screenshot({ path: `docs/screenshots/world-${width}.png` })

    // The HUD never covers a roof: every building (hover frame included) starts below the HUD's bottom edge, and
    // the bottom row's plaques stay above the control bar.
    const hud = (await page.locator('.fv-hud').boundingBox())!
    const bar = (await page.locator('.fv-control-bar').boundingBox())!
    for (const id of ['bank', 'office', 'hospital', 'home', 'market']) {
      const box = (await page.locator(`[data-building=${id}]`).boundingBox())!
      expect(box.y - px, `${id} roof under the HUD`).toBeGreaterThanOrEqual(hud.y + hud.height)
      expect(box.y + box.height + 9 * px, `${id} plaque under the control bar`).toBeLessThanOrEqual(bar.y)
    }
    const bank = page.getByRole('button', { name: /Open Pine Bank/ })
    await expect(bank.locator('.fv-building__hover')).toBeHidden()
    await bank.hover()
    await expect(bank.locator('.fv-building__hover')).toBeVisible()

    await bank.focus()
    const order: string[] = []
    for (let i = 0; i < 5; i++) {
      order.push(await page.evaluate(() => document.activeElement?.getAttribute('data-building') ?? ''))
      await page.keyboard.press('Tab')
    }
    expect(order).toEqual(['bank', 'office', 'hospital', 'home', 'market'])

    expect(errors).toEqual([])
  })
}
