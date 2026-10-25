import { test, expect, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { openTitle, startStory } from './helpers'

// OWNER: aspect-fit. Odd desktop aspect ratios: tall/narrow windows (portrait monitors and tablets with a mouse) and
// ultrawides. The zoom never cuts the 320x180 core (scale.ts), the window past the 480x288 map is filled with the
// grass-and-pines border tile, and the HUD, control bar, tips and windows anchor to the map's edges. Desktop only.

const SIZES: [number, number, number][] = [[800, 1000, 2], [1024, 1366, 3], [2560, 1080, 6], [3440, 1440, 8], [5120, 1440, 8]]
const OVERLAYS = ['.fv-hud', '.fv-control-bar', '.fv-flow-tools', '.fv-toasts', '.fv-coach-tip', '.fv-coach', '.fv-hud-footer', '.fv-window', '.fv-title-menu', '.fv-title-corners', '.fv-sign-wrap', '.fv-title-content']

/** Distinct colours in a square patch at a stage corner (side `size` CSS px) and whether every pixel is sky-blue. */
async function patch(page: Page, x: number, y: number, size: number) {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y, width: size, height: size } }))
  const colours = new Set<number>()
  let sky = true
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!]
    colours.add((r << 16) | (g << 8) | b)
    if (!(b > r && b >= g)) sky = false
  }
  return { colours: colours.size, sky }
}

/** The four corner patches. A 20x20 art-px patch (at least 40 CSS px) of border or ring art is never one flat colour. */
async function corners(page: Page, width: number, height: number, px: number) {
  const size = Math.max(40, 20 * px)
  const spots = [[0, 0], [width - size, 0], [0, height - size], [width - size, height - size]] as const
  return Promise.all(spots.map(([x, y]) => patch(page, x, y, size)))
}

/** Named overlays sit inside the viewport (nothing clipped or floating off-screen). */
async function expectInsideViewport(page: Page, screen: string) {
  const out = await page.evaluate((names) => names.flatMap((name) => Array.from(document.querySelectorAll<HTMLElement>(name)).map((el) => ({ name, r: el.getBoundingClientRect() })))
    .filter(({ r }) => r.width > 0 && (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5))
    .map(({ name, r }) => `${name} ${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)}`), OVERLAYS)
  expect(out, `${screen}: overlays inside the viewport`).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), `${screen}: no page scroll`).toBe(true)
}

/** The UI layer's inset from the viewport (GameStage's --ui-* variables, CSS px). */
const uiInset = (page: Page) => page.locator('.fv-stage').evaluate((el) => {
  const v = (name: string) => parseFloat(el.style.getPropertyValue(name)) || 0
  return { left: v('--ui-left'), top: v('--ui-top'), right: v('--ui-right'), bottom: v('--ui-bottom') }
})

for (const [width, height, px] of SIZES) {
  test(`${width}x${height}: title centred and covered, town at ${px}x with border, HUD and bar on the map's edges`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop aspect ratios')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/ai', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"disabled"}' }))
    await page.setViewportSize({ width, height })
    await openTitle(page)
    expect(await page.getByTestId('rotate-overlay').count(), 'a desktop window is not a phone').toBe(0)
    await expect(page.locator('.fv-stage')).toHaveAttribute('data-px', String(px))

    // Title: the scene fills the viewport, the sign and menu stay centred on it.
    const scene = (await page.locator('.fv-scene').boundingBox())!
    expect([scene.x, scene.y, scene.width, scene.height]).toEqual([0, 0, width, height])
    for (const name of ['.fv-sign-wrap', '.fv-title-menu']) {
      const box = (await page.locator(name).boundingBox())!
      expect(Math.abs(box.x + box.width / 2 - width / 2), `${name} centred`).toBeLessThanOrEqual(2)
    }
    await expectInsideViewport(page, 'title')
    const titleCorners = await corners(page, width, height, px)
    for (const [i, c] of titleCorners.entries()) {
      // Top corners are sky (the sky's own blue above the map, mirrored sky beside it); bottom corners are meadow border.
      if (i < 2) expect(c.sky, `title corner ${i} is sky`).toBe(true)
      else expect(c.colours, `title corner ${i} is not a flat colour`).toBeGreaterThanOrEqual(3)
    }

    // Town: every building on screen, the HUD on the map's top edge and the bar on its bottom edge, the border tiled.
    await startStory(page, 'College Student')
    await expect(page.locator('.fv-stage')).toHaveAttribute('data-px', String(px))
    const inset = await uiInset(page)
    const hud = (await page.getByRole('region', { name: 'Financial overview' }).boundingBox())!
    const bar = (await page.getByRole('group', { name: 'Time controls' }).boundingBox())!
    expect(hud.y, 'HUD top on the map top edge').toBeGreaterThanOrEqual(inset.top)
    expect(hud.y, 'HUD top on the map top edge').toBeLessThanOrEqual(inset.top + 2)
    expect(hud.x).toBeGreaterThanOrEqual(inset.left)
    expect(hud.x + hud.width).toBeLessThanOrEqual(width - inset.right + 0.5)
    expect(bar.y + bar.height, 'bar above the map bottom edge').toBeLessThanOrEqual(height - inset.bottom)
    expect(bar.y + bar.height, 'bar near the map bottom edge').toBeGreaterThan(height - inset.bottom - 60)
    for (const name of ['Pine Bank', 'Town Office', 'Health House', 'Your Home', 'Market Hall']) {
      const button = page.getByRole('button', { name: new RegExp(`^Open ${name}:`) })
      await expect(button).toBeVisible()
      const box = (await button.boundingBox())!
      expect(box.x, `${name} inside`).toBeGreaterThanOrEqual(0)
      expect(box.y + px, `${name} under the HUD`).toBeGreaterThanOrEqual(hud.y + hud.height)
      expect(box.x + box.width, `${name} inside`).toBeLessThanOrEqual(width)
      expect(box.y + box.height, `${name} above the bar`).toBeLessThanOrEqual(bar.y + 2 * px)
    }
    await expectInsideViewport(page, 'town')
    for (const [i, c] of (await corners(page, width, height, px)).entries()) expect(c.colours, `town corner ${i} is not a flat colour`).toBeGreaterThanOrEqual(3)
    const tip = page.locator('.fv-coach-tip')
    if (await tip.count()) {
      const t = (await tip.boundingBox())!
      expect(t.y + t.height).toBeLessThanOrEqual(height)
    }

    // A window opens inside the viewport with its header readable.
    await page.getByRole('button', { name: /^Open Pine Bank:/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Pine Bank' })
    await expect(dialog).toBeVisible()
    const win = (await dialog.locator('.fv-window').boundingBox())!
    expect(win.y).toBeGreaterThanOrEqual(0)
    expect(win.y + win.height).toBeLessThanOrEqual(height)
    expect(win.x).toBeGreaterThanOrEqual(0)
    expect(win.x + win.width).toBeLessThanOrEqual(width)
    await expect(dialog.getByRole('heading', { name: 'Pine Bank' })).toBeVisible()
    await page.getByRole('button', { name: 'Close panel' }).click()
    await expect(dialog).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
