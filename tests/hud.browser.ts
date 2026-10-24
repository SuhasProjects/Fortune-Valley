import { expect, test } from '@playwright/test'

for (const scale of [3, 4, 6]) {
  test(`UI gallery at scale ${scale}: sprites, fonts and keyboard focus`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/ai', route => route.fulfill({status:503,body:'offline'}))
    await page.goto(`/src/ui/dev/index.html?scale=${scale}`)
    await page.evaluate(() => document.fonts.ready)
    await page.getByRole('button', {name:'Load HUD example'}).click()
    await expect(page.getByRole('region', {name:'Financial overview'})).toContainText('Month 0 / 24')
    const invalidFonts = await page.locator('.fv-gallery').evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), invalid: string[] = []
      while (walker.nextNode()) {
        const node = walker.currentNode, element = node.parentElement
        if (!node.textContent?.trim() || !element || !element.getClientRects().length) continue
        const font = getComputedStyle(element).fontFamily
        if (!font.includes('Pixelify Sans') && !font.includes('VT323')) invalid.push(`${element.tagName}: ${font}`)
      }
      return invalid
    })
    expect(invalidFonts).toEqual([])
    expect(await page.evaluate(() => [...document.fonts].filter(font => font.status === 'error').map(font => font.family))).toEqual([])
    const brokenImages = await page.locator('img').evaluateAll(images => (images as HTMLImageElement[]).filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src))
    expect(brokenImages).toEqual([])
    await page.getByRole('button', {name:'Timeline'}).focus()
    await page.keyboard.press('Tab')
    expect(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
    expect(errors).toEqual([])
  })
}
for (const viewport of [{width:1280,height:720},{width:1440,height:900}]) {
  test(`HUD stays on one row at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.route('**/api/ai', route => route.fulfill({status:503,body:'offline'}))
    await page.goto('/src/ui/dev/index.html?scale=4')
    await page.getByRole('button', {name:'Load HUD example'}).click()
    await page.evaluate(() => document.fonts.ready)
    const boxes = await page.locator('.fv-hud').evaluate(element => {
      const outer = element.getBoundingClientRect()
      return [...element.children].filter(child => !child.classList.contains('fv-divider')).map(child => {
        const rect = child.getBoundingClientRect(); return {inside:rect.left >= outer.left && rect.right <= outer.right, center: Math.round(rect.top + rect.height / 2), height: rect.height}
      })
    })
    expect(boxes.every(box => box.inside)).toBe(true)
    expect(new Set(boxes.map(box => box.center)).size).toBe(1)
    await page.screenshot({path:`test-results/hud-${viewport.width}.png`})
  })
}
test('modal keyboard containment and return to opener work in a browser', async ({ page }) => {
  await page.goto('/src/ui/dev/index.html')
  const opener = page.getByRole('button', {name:'Open modal',exact:true})
  await opener.click()
  const dialog = page.getByRole('dialog', {name:'Your ledger'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', {name:'Close panel'})).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', {name:'Done'})).toBeFocused()
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', {name:'Close panel'})).toBeFocused()
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused()
})
