import { test, expect } from '@playwright/test'
import { openTitle, startStory } from './helpers'

test('trees render complete frames and keep their two-frame animation in title and town', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openTitle(page)
  const checkSway = async (selector: string) => {
    const tree = page.locator(selector).first()
    await expect(tree).toBeVisible()
    const frames = await tree.evaluate(async (el) => {
      const image = new Image()
      image.src = getComputedStyle(el).backgroundImage.slice(5, -2)
      await image.decode()
      const animation = el.getAnimations().find((a) => (a as CSSAnimation).animationName === 'fv-sheet')!
      animation.pause()
      const positions = [0, 900, 1800].map((time) => {
        animation.currentTime = time
        return getComputedStyle(el).backgroundPositionX
      })
      const style = getComputedStyle(el)
      return { positions, width: el.getBoundingClientRect().width, px: Number.parseFloat(style.getPropertyValue('--px')), imageWidth: image.naturalWidth, duration: animation.effect!.getTiming().duration }
    })
    expect(frames.imageWidth).toBe(56)
    expect(frames.width).toBe(28 * frames.px)
    expect(frames.duration).toBe(1800)
    expect(frames.positions).toEqual(['0px', `${-28 * frames.px}px`, '0px'])
  }
  await checkSway('.fv-scene [data-sprite="world/props/tree-round"]')
  await page.screenshot({ path: `test-results/trees-title-${test.info().project.name}.png` })
  await startStory(page, 'College Student')
  await checkSway('.fv-town [data-sprite="world/props/tree-round"]')
  await page.screenshot({ path: `test-results/trees-town-${test.info().project.name}.png` })
})
