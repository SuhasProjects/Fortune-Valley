import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({viewport:{width:1440,height:900}})
await page.goto('http://127.0.0.1:5175/src/ui/dev/index.html')
await page.getByRole('button',{name:'Load HUD example'}).click()
await page.evaluate(() => document.fonts.ready)
console.log(await page.evaluate(() => ({fonts:[...document.fonts].map(font => ({family:font.family,status:font.status})), title:document.querySelector('h1').textContent})))
await page.screenshot({path:'test-results/gallery.png',fullPage:true})
await browser.close()
