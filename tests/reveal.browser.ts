import { test, expect } from '@playwright/test'
import { openTitle, startStory, expectReveal, leaveReveal } from './helpers'

test.beforeEach(async ({page}) => {
  await page.route('**/api/ai', route => route.fulfill({status:503,contentType:'application/json',body:'{"code":"disabled"}'}))
})

test('played results show four engine endings, offline explanation, and return to title', async ({page}) => {
  const errors: string[] = []; page.on('pageerror',error => errors.push(error.message))
  await openTitle(page); await startStory(page,'Entry-Level Worker')
  await page.getByRole('button', {name:/Open Pine Bank:/}).click()
  await page.getByLabel('Monthly savings contribution (USD)', {exact:true}).fill('300')
  await page.getByRole('button', {name:'Save savings contribution',exact:true}).click()
  await page.getByRole('button', {name:'Close panel',exact:true}).click()
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Finish & reveal/}).click()
  await expectReveal(page)
  await expect(page.getByRole('heading', {name:/You finished month 2 with/})).toBeVisible()
  // Recap under the headline: the offline template (3 sentences) shows at once while /api/ai is down.
  await expect(page.getByText('Recap', {exact:true})).toBeVisible()
  expect(((await page.locator('.fv-reveal-recap-text').textContent()) ?? '').match(/\.(\s|$)/g)).toHaveLength(3)
  // Desktop labels the line ends inside the SVG; phones list them under the plot. Both are buttons in the figure.
  await expect(page.getByRole('group', {name:'Your 1,000 futures: four ending net worth lines'})).toBeVisible()
  const chart = page.getByRole('figure', {name:'Your 1,000 futures'})
  await expect(chart.getByRole('button')).toHaveCount(4)
  for (const label of ['Unlucky (10th)','Typical','Lucky (90th)','You:']) await expect(chart.getByRole('button', {name:new RegExp(label.replace('(','\\(').replace(')','\\)'))})).toBeVisible()
  // Short copy: no spread sentence under the headline, and the chart's own caption is for screen readers only.
  await expect(page.getByText(/8 in 10/)).toHaveCount(0)
  await expect(page.getByRole('heading', {name:'Same strategy, 1,000 futures'})).toBeVisible()
  await page.getByLabel('Ask about your results', {exact:true}).fill('Why did these futures differ?')
  await page.getByRole('button', {name:'Ask',exact:true}).click()
  await expect(page.getByText('Offline explanation (template)', {exact:true})).toBeVisible()
  await expect(page.getByRole('button', {name:'Ask',exact:true})).toBeEnabled()
  await leaveReveal(page)
  expect(errors).toEqual([])
})

test('finishing without decisions still offers "from the start" comparisons', async ({page}) => {
  await openTitle(page); await startStory(page,'College Student')
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Finish & reveal/}).click()
  await expectReveal(page)
  const pick = page.getByRole('combobox', {name:'Pick a decision',exact:true})
  await expect(pick).toBeVisible()
  await pick.click()
  const options = page.getByRole('listbox', {name:'Pick a decision'}).getByRole('option')
  await expect(options).not.toHaveCount(0)
  expect((await options.allTextContents()).every(text => text.startsWith('From the start'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(pick).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Typical', exact: true })).toBeVisible({ timeout: 15_000 })
})

// Isolate the comparison UI from simulation speed so selection, shared axes, cancellation and stale responses
// can be tested deterministically. Other reveal tests use Agent 1's real engine.
test('comparison selectors show paired charts with shared axes and replace an in-flight run', async ({page}) => {
  await page.route('**/src/game/reveal/ending-contract.ts*', route => route.fulfill({contentType:'application/javascript',body:`
    const original = {months:2,start:-14000,p10:-15000,median:-13000,p90:-10000,yourEvents:-12000,spread:5000};
    export const originalLines = () => original;
    export const endingApi = {
      listDecisions: () => [{id:'0',logIndex:0,monthIndex:0,label:'Month 0 · Save $300/month',alternatives:[{id:'undo',label:'Keep what you had before'},{id:'half',label:'Save half'}]}],
      runWhatIfAsync: (input,signal) => new Promise((resolve,reject) => {
        const timer = setTimeout(() => resolve({original,changed:{months:2,start:-14000,p10:-14000,median:-11760,p90:-11000,yourEvents:-12310,spread:3000},delta:{p10:1000,median:1240,p90:-1000,yourEvents:-310,spread:-2000},decisionLabel:'Save $300/month',alternativeLabel:input.alternativeId === 'half' ? 'Save half' : 'Keep what you had before',yourEventsComparable:true,replayFallbacks:0}),250);
        signal?.addEventListener('abort',() => {clearTimeout(timer);document.documentElement.dataset.fvAborts = String(Number(document.documentElement.dataset.fvAborts ?? 0)+1);reject(new DOMException('Aborted','AbortError'))},{once:true});
      })
    };
  `}))
  await openTitle(page); await startStory(page,'Entry-Level Worker')
  await page.getByRole('button', {name:/Open Pine Bank:/}).click()
  await page.getByLabel('Monthly savings contribution (USD)', {exact:true}).fill('300')
  await page.getByRole('button', {name:'Save savings contribution',exact:true}).click()
  await page.getByRole('button', {name:'Close panel',exact:true}).click()
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Finish & reveal/}).click()
  await expectReveal(page)
  const decision = page.getByRole('combobox', {name:'Pick a decision',exact:true})
  await decision.click(); await page.getByRole('option', {name:'Month 0 · Save $300/month'}).click()
  await expect(page.getByText('If you had: Keep what you had before', {exact:true})).toBeVisible()
  await expect(page.getByText('+$1,240', {exact:true})).toBeVisible()
  await expect(page.getByText('-$310', {exact:true})).toBeVisible()
  await expect(page.getByText('Narrower by $2,000', {exact:true})).toBeVisible()
  await expect(page.getByRole('heading', {name:'Your run', exact:true})).toBeVisible()
  // End labels (name and value lines) stay inside their SVG's viewBox on both charts.
  const labelOverflow = await page.locator('.fv-comparison-charts svg').evaluateAll(svgs => svgs.map(svg => {
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2])
    return [...svg.querySelectorAll('[role=button] > text')].some(text => { const b = (text as SVGGraphicsElement).getBBox(); return b.x + b.width > width })
  }))
  expect(labelOverflow).toEqual([false, false])
  const ticks = await page.locator('.fv-comparison-charts .fv-outcome-chart').evaluateAll(charts => charts.map(chart => [...chart.querySelectorAll('.fv-axis-tick')].map(tick => tick.textContent)))
  expect(ticks).toHaveLength(2); expect(ticks[0]).toEqual(ticks[1]); expect(ticks[0]![2]).toBe('$0')
  // Every drawn line, marker and wedge sits inside the plot box.
  const overshoot = await page.locator('.fv-comparison-charts svg').evaluateAll(svgs => svgs.map(svg => {
    const clip = svg.querySelector('clipPath rect')!, box = { x: Number(clip.getAttribute('x')), y: Number(clip.getAttribute('y')), w: Number(clip.getAttribute('width')), h: Number(clip.getAttribute('height')) }
    return [...svg.querySelectorAll('.fv-line-draw, circle, rect[stroke]')].filter(el => !el.closest('[role=button]')).some(el => {
      const b = (el as SVGGraphicsElement).getBBox(); return b.x < box.x || b.y < box.y || b.x + b.width > box.x + box.w || b.y + b.height > box.y + box.h
    })
  }))
  expect(overshoot).toEqual([false, false])
  const previousAborts = await page.evaluate(() => Number(document.documentElement.dataset.fvAborts ?? 0))
  const alternative = page.getByRole('combobox', {name:'Instead…',exact:true})
  // Keyboard: ArrowDown opens the listbox, arrows move, Enter chooses.
  await alternative.focus(); await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox', {name:'Instead…'})).toBeVisible()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
  await expect(alternative).toHaveText('Save half')
  await expect(page.getByText('Re-running 1,000 futures…', {exact:true})).toBeVisible()
  await alternative.click(); await page.getByRole('option', {name:'Keep what you had before'}).click()
  await expect(page.getByText('If you had: Keep what you had before', {exact:true})).toBeVisible()
  expect(await page.evaluate(() => Number(document.documentElement.dataset.fvAborts ?? 0))).toBeGreaterThan(previousAborts)
})
