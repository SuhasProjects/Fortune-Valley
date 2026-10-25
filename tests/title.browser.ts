import { test, expect } from '@playwright/test'
import { openTitle, startStory, expectReveal, leaveReveal } from './helpers'

// OWNER: Agent 5. Public title/story contracts used by the other agents' helpers.
test('title uses pixel fonts, three menu buttons, and keyboard navigation', async ({ page }) => {
  await openTitle(page)
  await expect(page).toHaveTitle('Fortune Valley')
  await expect(page.getByRole('heading', {name:'Fortune Valley',exact:true})).toHaveCSS('font-family', /Pixelify Sans/)
  const menu = page.getByRole('group', {name:'Main menu'})
  await expect(menu.getByRole('button')).toHaveCount(3)
  await expect(menu.getByRole('button', {name:'Continue',exact:true})).toBeDisabled()
  await menu.getByRole('button', {name:'New Story',exact:true}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(menu.getByRole('button', {name:'Custom Story',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', {name:/College Student/})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu.getByRole('button', {name:'New Story',exact:true})).toBeFocused()
  await expect(page.getByRole('button', {name:'Sign in',exact:true})).toHaveCount(0)
})

test('Options and Guide restore focus and support keyboard chapters', async ({ page }) => {
  await openTitle(page)
  await page.getByRole('button', {name:'Options',exact:true}).click()
  await expect(page.getByRole('dialog', {name:'Options',exact:true})).toBeVisible()
  await page.getByLabel('Reduce motion').check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', {name:'Options',exact:true})).toBeFocused()
  await page.getByRole('button', {name:'Guide',exact:true}).click()
  await expect(page.getByRole('dialog', {name:'Guide',exact:true})).toBeVisible()
  await page.getByRole('tab', {name:'How to play',exact:true}).focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', {name:'About',exact:true})).toHaveAttribute('aria-selected','true')
  await page.getByRole('tab', {name:'FAQ',exact:true}).click()
  await page.getByText('Is any real money involved?', {exact:true}).click()
  await expect(page.getByText('No. Every balance, paycheck, investment, and payment belongs to a fictional simulation. No bank connection is needed.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', {name:'Guide',exact:true})).toBeFocused()
})

test('title has no page scroll at laptop sizes or narrow phones', async ({ page }, testInfo) => {
  for (const viewport of [{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080},{width:320,height:740}]) {
    await page.setViewportSize(viewport)
    if (testInfo.project.name.startsWith('mobile') && viewport.height > viewport.width) {
      // A phone held upright gets the "turn your phone sideways" notice instead of the title; it must not scroll either.
      await page.goto('/')
      await expect(page.getByRole('dialog', {name:'Turn your phone sideways'})).toBeVisible()
      expect(await page.evaluate(() => ({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width:viewport.width,height:viewport.height})
      continue
    }
    await openTitle(page)
    expect(await page.evaluate(() => ({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width:viewport.width,height:viewport.height})
    await page.getByRole('button', {name:'New Story',exact:true}).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
  }
})

test('story picker cards never overlap and each starts its story with a plain click', async ({ page }) => {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720}]) {
    await page.setViewportSize(viewport)
    await openTitle(page)
    await page.getByRole('button', {name:'New Story',exact:true}).click()
    const cards = page.locator('.fv-story-card')
    await expect(cards).toHaveCount(4)
    const boxes = await cards.evaluateAll(elements => elements.map(element => {
      // Include every descendant (portraits, text) so nothing drawn by one card can sit over another.
      const rects = [element, ...element.querySelectorAll('*')].map(node => node.getBoundingClientRect())
      return {left:Math.min(...rects.map(r => r.left)),right:Math.max(...rects.map(r => r.right)),top:Math.min(...rects.map(r => r.top)),bottom:Math.max(...rects.map(r => r.bottom))}
    }))
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const overlap = boxes[a]!.left < boxes[b]!.right && boxes[b]!.left < boxes[a]!.right && boxes[a]!.top < boxes[b]!.bottom && boxes[b]!.top < boxes[a]!.bottom
      expect(overlap, `card ${a} overlaps card ${b} at ${viewport.width}×${viewport.height}`).toBe(false)
    }
  }
  for (const life of ['College Student','Entry-Level Worker','Established Professional','Young Family']) {
    await openTitle(page)
    await page.getByRole('button', {name:'New Story',exact:true}).click()
    await page.getByRole('button', {name:new RegExp(life)}).click({timeout:5_000})
    await expect(page.getByRole('button', {name:/Open Pine Bank:/})).toBeVisible()
    await expect(page.getByText(new RegExp(life)).first()).toBeVisible()
  }
})

test('offline custom story accepts numbers, shows a preview, and starts', async ({ page }) => {
  let request: Record<string,unknown> | null = null
  await page.route('**/api/ai', route => { request = route.request().postDataJSON(); return route.fulfill({status:503,contentType:'application/json',body:'{"code":"disabled"}'}) })
  await openTitle(page)
  await page.getByRole('button', {name:'Custom Story',exact:true}).click()
  await page.getByLabel('What would you like to explore?').fill('I want to save while paying off student debt.')
  await page.getByText('Add numbers', {exact:false}).click()
  await page.getByLabel('Yearly income (USD)', {exact:true}).fill('48000')
  await page.getByRole('button', {name:'Write my story',exact:true}).click()
  await expect(page.getByText('Made offline from a template', {exact:true})).toBeVisible()
  expect(request).toMatchObject({kind:'scenario',input:{grossAnnualIncome:48000}})
  await page.getByRole('button', {name:'Edit',exact:true}).click()
  await expect(page.getByLabel('What would you like to explore?')).toHaveValue('I want to save while paying off student debt.')
  await page.getByRole('button', {name:'Write my story',exact:true}).click()
  await page.getByRole('button', {name:'Start this story',exact:true}).click()
  await expect(page.getByRole('button', {name:/Open Pine Bank:/})).toBeVisible()
})

test('Continue restores the saved month', async ({ page }) => {
  await openTitle(page)
  await startStory(page,'College Student')
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Finish & reveal/}).click()
  await expectReveal(page)
  await leaveReveal(page)
  await expect(page.getByRole('button', {name:/Continue.*Month 1/})).toBeEnabled()
  await page.getByRole('button', {name:/Continue.*Month 1/}).click()
  await expect(page.getByText(/^Month 1 \/ \d+$/)).toBeVisible()
})
