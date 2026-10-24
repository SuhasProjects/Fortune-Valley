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
  const chart = page.getByRole('group', {name:'Your 1,000 futures: four ending net worth lines'})
  await expect(chart.getByRole('button')).toHaveCount(4)
  for (const label of ['Unlucky','Typical','Lucky','What actually happened']) await expect(chart.getByRole('button', {name:new RegExp(label)})).toBeVisible()
  await page.getByLabel('Ask about your results', {exact:true}).fill('Why did these futures differ?')
  await page.getByRole('button', {name:'Ask',exact:true}).click()
  await expect(page.getByText('Offline explanation (template)', {exact:true})).toBeVisible()
  await expect(page.getByRole('button', {name:'Ask',exact:true})).toBeEnabled()
  await leaveReveal(page)
  expect(errors).toEqual([])
})

test('finishing without decisions explains how to unlock comparisons', async ({page}) => {
  await openTitle(page); await startStory(page,'College Student')
  await page.getByRole('button', {name:/Next month/}).click()
  await page.getByRole('button', {name:/Finish & reveal/}).click()
  await expectReveal(page)
  await expect(page.getByText('You didn’t change any settings this time. Next story, visit a building and make a choice to compare.')).toBeVisible()
  await expect(page.getByLabel('Pick a decision', {exact:true})).toHaveCount(0)
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
  await decision.selectOption('0')
  await expect(page.getByText('If you had: Keep what you had before', {exact:true})).toBeVisible()
  await expect(page.getByText('+$1,240', {exact:true})).toBeVisible()
  await expect(page.getByText('-$310', {exact:true})).toBeVisible()
  await expect(page.getByText('Narrower by $2,000', {exact:true})).toBeVisible()
  const ticks = await page.locator('.fv-comparison-charts .fv-outcome-chart').evaluateAll(charts => charts.map(chart => [...chart.querySelectorAll('.fv-axis-tick')].map(tick => tick.textContent)))
  expect(ticks).toHaveLength(2); expect(ticks[0]).toEqual(ticks[1])
  const previousAborts = await page.evaluate(() => Number(document.documentElement.dataset.fvAborts ?? 0))
  const alternative = page.getByRole('combobox', {name:'Instead…',exact:true})
  await alternative.selectOption('half')
  await expect(page.getByText('Re-running 1,000 futures…', {exact:true})).toBeVisible()
  await alternative.selectOption('undo')
  await expect(page.getByText('If you had: Keep what you had before', {exact:true})).toBeVisible()
  expect(await page.evaluate(() => Number(document.documentElement.dataset.fvAborts ?? 0))).toBeGreaterThan(previousAborts)
})
