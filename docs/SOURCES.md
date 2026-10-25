# Sources and Assumptions

Fortune Valley is a teaching simulation, not a forecast. Every return, rate, cost and probability in the game is an
illustrative assumption chosen so a lesson reads clearly on a 12 to 36 month chart. Where a number is anchored to a
published figure, this page says what the figure is, where it comes from, and how far the game moves away from it.
Nothing here is financial advice.

All assumptions live in `src/config/defaults.ts` and `src/config/archetypes.ts`.

---

## 1. Investment returns and volatility

The market model is geometric Brownian motion: each month every asset class takes a lognormal step with a fixed drift
and volatility, and the three classes are correlated. This is the standard textbook model for asset prices (Hull).

| Asset class | Game value (return / volatility) | Long-run historical figure | Why it differs |
|---|---|---|---|
| S&P 500 index ETF | 10% / 18% | About 10% / 19% for the S&P 500, 1928 to 2024 (Damodaran) | Essentially historical. |
| Tech stock basket | 13% / 40% | About 12% / 35% for a concentrated large-cap tech basket | Stretched slightly so a single stock reads apart from an index fund. |
| Bond fund | 4.5% / 6% | About 4.5% / 6% for the US aggregate bond market (Damodaran, Bloomberg US Aggregate) | Essentially historical. |
| Correlations | stock to ETF 0.75, stock to bond 0.10 | High stock-to-index, near-zero stock-to-bond (Damodaran) | Rounded. |

## 2. Interest rates and taxes

| Item | Game value | Published figure | Source |
|---|---|---|---|
| Savings account APY | 4.0% | High-yield accounts paid 4 to 5% in 2024; the national average is well under 1% | FDIC |
| Credit card APR | 20 to 25% | Average assessed APR about 22 to 23% in 2024 | Federal Reserve G.19 |
| Student loan APR | 5.5 to 7% | 6.53% for undergraduate Direct Loans, 2024 to 2025 | Federal Student Aid |
| Emergency credit APR | 24% | Priced like a credit card | Federal Reserve G.19 |
| Federal income tax | 10, 12, 22, 24, 32% brackets; $14,600 standard deduction | 2024 single-filer brackets and deduction | IRS |
| Payroll tax | 7.65% | 6.2% Social Security plus 1.45% Medicare, employee share | Social Security Administration |

Simplifications: the 35% and 37% brackets are collapsed into a flat 32% top bracket; there is no state tax, no tax
credits and no wage-base cap on payroll tax.

## 3. Insurance

| Plan | Game value | Published comparison | Source |
|---|---|---|---|
| Basic Health (high deductible) | $180/month, $4,000 deductible, 30% coinsurance, $8,000 out-of-pocket max | Worker share of single coverage averaged about $114/month in employer plans; unsubsidised marketplace plans cost far more | KFF |
| Plus Health (low deductible) | $340/month, $1,000 deductible, 20% coinsurance, $4,000 out-of-pocket max | Same survey; 2024 legal out-of-pocket maximum is $9,450 | KFF; HealthCare.gov |
| Family Health | $620/month, $2,500 deductible | Family coverage worker share averaged about $525/month | KFF |
| Auto, liability only | $70/month | AAA puts average full-coverage insurance near $1,700 to $1,800 per year | AAA |
| Auto, full coverage | $145/month, $1,000 deductible | Same | AAA |
| Renters | $18/month, $500 deductible, $20,000 cap | Typical US renters policy, $15 to $20 per month | Insurer rate guides |

The two health plans are pushed apart on purpose so the premium-versus-deductible trade-off is visible in one run.

## 4. Unexpected events

| Event | Game value | What the data says | Source |
|---|---|---|---|
| Medical emergency | 4% chance per month; median cost $2,500, lognormal spread, capped at $60,000 | Roughly one in six adults reports a major unexpected expense in a year; one in four skipped medical care over cost | Federal Reserve SHED |
| Car repair or accident | 3.5% per month; median $1,200. Only when the household owns a car | Maintenance and repair costs by vehicle class | AAA |
| Theft or apartment damage | 1.5% per month; median $1,500 | Illustrative | — |
| Job loss | 0.9% per month (about 10% per year) | Layoffs and discharges run about 1.0 to 1.2% of employment per month | BLS JOLTS |
| Unemployment benefit | Capped at $2,200/month | Most state maximums fall between $400 and $700 per week | State UI programs |
| Small life events (gifts and costs) | 45% chance per month, $20 to $300, net about zero over a run | Small irregular outlays | BLS Consumer Expenditure Survey |

The medical shock rate is deliberately high (about 39% per year) so that a 36-month run usually shows at least one bill.

## 5. Households

Each starting story (student, new graduate, entry-level worker, parent, professional) uses rounded incomes, rents,
debts and balances that sit inside typical ranges from BLS wage data and rental listings. They are fictional people,
not averages of any dataset.

## 6. Monte Carlo

Every ending is replayed across 1,000 futures. Each future has its own random seed for markets, shocks, employment and
life events, so a what-if comparison reuses exactly the same luck. At 1,000 paths the sampling error on the 10th and
90th percentiles is a few hundred dollars at the scales shown.

## 7. Demo mode

The `/demo` route replaces every random roll with a fixed script (one $20,000 emergency-room visit and four small
events) and uses its own stretched Monte Carlo settings so the insurance lesson is unmistakable on camera. Those
numbers are invented for the presentation and are not drawn from any source.

---

## Works Cited (MLA)

AAA. *Your Driving Costs 2024*. American Automobile Association, Sept. 2024,
https://newsroom.aaa.com/2024/09/your-driving-costs-2024/.

Board of Governors of the Federal Reserve System. *Consumer Credit – G.19*. Federal Reserve, 2024,
https://www.federalreserve.gov/releases/g19/current/.

Board of Governors of the Federal Reserve System. *Economic Well-Being of U.S. Households (SHED)*. Federal Reserve,
2024, https://www.federalreserve.gov/publications/report-economic-well-being-us-households.htm.

Damodaran, Aswath. *Historical Returns on Stocks, Bonds and Bills: 1928–2024*. NYU Stern School of Business, 2025,
https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html.

Federal Deposit Insurance Corporation. *National Rates and Rate Caps*. FDIC, 2024,
https://www.fdic.gov/national-rates-and-rate-caps.

Federal Student Aid. *Interest Rates and Fees for Federal Student Loans*. U.S. Department of Education, 2024,
https://studentaid.gov/understand-aid/types/loans/interest-rates.

HealthCare.gov. "Out-of-Pocket Maximum/Limit." *HealthCare.gov Glossary*, Centers for Medicare and Medicaid Services,
https://www.healthcare.gov/glossary/out-of-pocket-maximum-limit/.

Hull, John C. *Options, Futures, and Other Derivatives*. 11th ed., Pearson, 2021.

Internal Revenue Service. "IRS Provides Tax Inflation Adjustments for Tax Year 2024." *IRS Newsroom*, 9 Nov. 2023,
https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024.

KFF. *2024 Employer Health Benefits Survey*. Kaiser Family Foundation, Oct. 2024,
https://www.kff.org/health-costs/report/2024-employer-health-benefits-survey/.

Social Security Administration. "Contribution and Benefit Base." *SSA Office of the Chief Actuary*,
https://www.ssa.gov/oact/cola/cbb.html.

U.S. Bureau of Labor Statistics. *Consumer Expenditure Surveys*. U.S. Department of Labor,
https://www.bls.gov/cex/.

U.S. Bureau of Labor Statistics. *Job Openings and Labor Turnover Survey (JOLTS)*. U.S. Department of Labor,
https://www.bls.gov/jlt/.

U.S. Bureau of Labor Statistics. *The Employment Situation*. U.S. Department of Labor,
https://www.bls.gov/news.release/empsit.toc.htm.
