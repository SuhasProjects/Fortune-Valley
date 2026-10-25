# Where the numbers come from

Fortune Valley is a teaching simulation, not a forecast. Every probability, return, rate and cost in
`src/config/defaults.ts` is an **illustrative assumption**: a round number chosen so the lesson reads clearly on a
12–36 month chart. None of them was scraped from a website or fitted to data. Where a number is anchored to a
public reference, the reference and how we moved away from it are listed below so anyone can check or retune it.

| Assumption (file) | Value in the game | Anchor / reference | Notes |
|---|---|---|---|
| Tech stock basket return / volatility (`assets.stock`) | 13% / 40% | Damodaran, *Historical Returns on Stocks, Bonds and Bills* (NYU Stern): https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html | Large-cap US stocks have averaged roughly 10%/yr with ~17–20% volatility since 1928; a single concentrated tech basket is more like 12%/35%. Stretched to 13%/40% so one stock visibly differs from an index fund. |
| S&P 500 index ETF return / volatility (`assets.etf`) | 10% / 18% | Same Damodaran dataset (S&P 500 arithmetic average, standard deviation) | Close to the long-run nominal average; volatility rounded up slightly. |
| Bond fund return / volatility (`assets.bond`) | 4.5% / 6% | Damodaran dataset (10-year Treasury / Baa corporate series); Bloomberg US Aggregate Bond Index long-run figures | Aggregate bond funds have returned roughly 4–5%/yr nominal with ~5–6% volatility. |
| Correlations stock–ETF 0.75, stock–bond 0.1 (`correlation`) | 0.75 / 0.1 | Same Damodaran series (stock/bond correlation is low and unstable) | Single-stock vs index correlation is high but not 1; bonds roughly uncorrelated. |
| Monthly return model | Geometric Brownian motion, lognormal monthly step, drift `ln(1+r)/12 − σ²/24` | Standard GBM (Black–Scholes assumption); see Hull, *Options, Futures and Other Derivatives*, ch. on stochastic processes | `expectedAnnualReturn` is the arithmetic mean; the median path sits below it, as for a real index. |
| Savings APY (`savingsApy`) | 4% | FDIC national deposit rates and rate caps: https://www.fdic.gov/national-rates-and-rate-caps | High-yield savings accounts paid ~4–5% in 2024; national average is far lower. 4% chosen as a “good account”. |
| Credit-card APR (archetypes) | 20–25% | Federal Reserve G.19 Consumer Credit (average card APR): https://www.federalreserve.gov/releases/g19/current/ | Average assessed card APR was ~22–23% in 2024. |
| Student-loan APR (archetypes) | ~5.5–7% | Federal Student Aid interest rates: https://studentaid.gov/understand-aid/types/loans/interest-rates | Undergraduate direct loans 2024–25: 6.53%. |
| Overdraft / emergency credit APR (`overdraftApr`) | 24% | Same G.19 card APR; emergency credit priced like a card | Illustrative. |
| Federal tax brackets, standard deduction (`tax`) | 10/12/22/24/32%, $14,600 deduction | IRS tax-year 2024 inflation adjustments: https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024 | Real 2024 single-filer brackets up to 24%; the 35% and 37% brackets collapsed into a flat 32% top. No state tax, credits or filing logic. |
| Payroll rate (`payrollRate`) | 7.65% | Social Security + Medicare employee share (6.2% + 1.45%): https://www.ssa.gov/oact/cola/cbb.html | Exact statutory employee rate; no wage-base cap modelled. |
| Health plans (`insurancePlans`) | Basic $180/mo, $4,000 deductible, 30% coinsurance, $8,000 OOP max; Plus $340/mo, $1,000 deductible, 20%, $4,000 OOP max; Family $620/mo | KFF 2024 Employer Health Benefits Survey: https://www.kff.org/health-costs/report/2024-employer-health-benefits-survey/ ; HealthCare.gov out-of-pocket maximum: https://www.healthcare.gov/glossary/out-of-pocket-maximum-limit/ | Worker contribution for single coverage averaged ~$114/mo (employer-sponsored); marketplace premiums without subsidy are far higher. Deductibles and OOP maxes are within real ranges (2024 legal OOP max $9,450). Premiums stretched apart so the trade-off is visible. |
| Auto insurance (`insurancePlans`) | Liability $70/mo; full coverage $145/mo, $1,000 deductible | AAA *Your Driving Costs 2024*: https://newsroom.aaa.com/2024/09/your-driving-costs-2024/ | AAA puts average full-coverage insurance near $1,700–1,800/yr; running costs per car band (`CAR_VALUE_BANDS`) are rounded from the same report’s fuel + maintenance figures. |
| Renters insurance | $18/mo, $500 deductible, $20k cap | Typical US renters policy (~$15–20/mo) per insurer rate guides | Illustrative. |
| Medical emergency incidence (`shocks.medical`) | 4%/month, median $2,500, lognormal σ 0.9, cap $60k | Federal Reserve SHED (Economic Well-Being of U.S. Households), unexpected-expense and medical-debt chapters: https://www.federalreserve.gov/publications/report-economic-well-being-us-households.htm | SHED reports ~1 in 4 adults skipped medical care over cost and ~1 in 6 had an unexpected major expense in a year. 4%/month (~39% per year) is deliberately high so a 36-month run usually sees one. |
| Car repair / accident incidence (`shocks.auto`) | 3.5%/month, median $1,200 | AAA driving-costs report (maintenance/repair) and insurer claim-frequency statistics | Illustrative; only rolls when the household owns a car. |
| Theft / apartment damage (`shocks.home`) | 1.5%/month, median $1,500 | Illustrative | Low frequency, renters-insurance teaching case. |
| Job loss (`jobLossMonthlyIncidence`) | 0.9%/month (~10%/yr) | BLS JOLTS layoffs and discharges (~1.0–1.2% of employment per month): https://www.bls.gov/jlt/ ; BLS Employment Situation: https://www.bls.gov/news.release/empsit.toc.htm | Rounded to one decimal; re-employment handled by scripted offers. |
| Unemployment benefit cap | $2,200/month | State UI maximums (most states $400–$700/week) | Illustrative mid-range. |
| Life events (`DEFAULT_LIFE_EVENTS`) | 45%/month chance of a small gift or cost, $20–$300, net ≈ 0 | BLS Consumer Expenditure Survey for small irregular outlays: https://www.bls.gov/cex/ | Amounts chosen so gifts and costs roughly cancel; purely flavour. |
| Rent, incomes, debts per story (`src/config/archetypes.ts`) | e.g. student $30k/yr, $340 room; professional $40k invested | Rounded from BLS Occupational Employment and Wages and typical rents; not location-specific | Fictional households. |
| Monte Carlo path count | 1,000 futures | Convention; percentile error at 1,000 paths is a few hundred dollars on these scales | Seeded per path (`src/engine/rng.ts`) so what-ifs share the same luck. |

Some of the government pages above (bls.gov, ssa.gov, aaa.com) refuse automated requests and return 403 to scripts;
they open normally in a browser.

## Demo mode

`/demo` (src/demo/demoMode.ts) replaces the random rolls with a fixed script (one $20,000 ER visit and four small
events) and uses its own stretched Monte Carlo assumptions so the insurance lesson is unmistakable on camera. Those
numbers are fabricated for the presentation and are not derived from any source.
