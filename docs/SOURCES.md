Fortune Valley is a teaching simulation. Every return, rate, cost and probability is an illustrative assumption chosen so a lesson reads clearly on a 12 to 36 month chart. Where a number is anchored to a published figure, the anchor and the gap are noted. All assumptions live in src/config/defaults.ts and src/config/archetypes.ts. Nothing here is financial advice.

Investment returns (monthly geometric Brownian motion, correlated)

- S&P 500 index ETF: 10% return, 18% volatility. Historical S&P 500, 1928 to 2024: about 10% / 19% (Damodaran).
- Tech stock basket: 13% / 40%. A concentrated large-cap tech basket is about 12% / 35%; stretched so one stock reads apart from an index fund.
- Bond fund: 4.5% / 6%. US aggregate bond market long run: about 4.5% / 6% (Damodaran; Bloomberg US Aggregate).
- Correlations: stock to ETF 0.75, stock to bond 0.10 (Damodaran, rounded).

Interest rates and taxes

- Savings APY 4%. High-yield accounts paid 4 to 5% in 2024; national average well under 1% (FDIC).
- Credit card APR 20 to 25%. Average assessed APR about 22 to 23% in 2024 (Federal Reserve G.19).
- Student loan APR 5.5 to 7%. Undergraduate Direct Loans 2024 to 2025: 6.53% (Federal Student Aid).
- Emergency credit APR 24%, priced like a card (Federal Reserve G.19).
- Federal income tax: 10, 12, 22, 24, 32% brackets, $14,600 standard deduction. 2024 single-filer figures (IRS); the 35% and 37% brackets are collapsed into 32%. No state tax or credits.
- Payroll tax 7.65%: 6.2% Social Security plus 1.45% Medicare, employee share (SSA). No wage-base cap.

Insurance

- Basic Health: $180/month, $4,000 deductible, 30% coinsurance, $8,000 out-of-pocket max.
- Plus Health: $340/month, $1,000 deductible, 20% coinsurance, $4,000 out-of-pocket max.
- Family Health: $620/month, $2,500 deductible.
  Worker share of employer single coverage averaged about $114/month and family about $525/month in 2024 (KFF); the legal out-of-pocket maximum was $9,450 (HealthCare.gov). The two single plans are pushed apart on purpose so the premium versus deductible trade-off shows in one run.
- Auto liability $70/month; full coverage $145/month with $1,000 deductible. Average full coverage about $1,700 to $1,800 per year (AAA).
- Renters $18/month, $500 deductible, $20,000 cap. Typical policy $15 to $20 per month.

Unexpected events

- Medical emergency: 4% per month, median $2,500, lognormal, capped at $60,000. About one in six adults reports a major unexpected expense in a year and one in four skipped care over cost (Federal Reserve SHED). Rate set high (about 39% per year) so a 36-month run usually shows one bill.
- Car repair or accident: 3.5% per month, median $1,200, only with a car. Maintenance and repair costs by vehicle class (AAA).
- Theft or apartment damage: 1.5% per month, median $1,500. Illustrative.
- Job loss: 0.9% per month, about 10% per year. Layoffs and discharges run about 1.0 to 1.2% of employment per month (BLS JOLTS).
- Unemployment benefit capped at $2,200/month. Most state maximums are $400 to $700 per week.
- Small gifts and costs: 45% per month, $20 to $300, net about zero over a run (BLS Consumer Expenditure Survey for scale).

Households

Starting stories use rounded incomes, rents, debts and balances inside typical ranges from BLS wage data and rental listings. They are fictional people, not averages.

Monte Carlo

Each ending is replayed across 1,000 futures, each with its own random seed for markets, shocks, employment and life events, so a what-if reuses the same luck. Sampling error on the 10th and 90th percentiles at 1,000 paths is a few hundred dollars at these scales.

Demo mode

The /demo route replaces random rolls with a fixed script (one $20,000 emergency-room visit and four small events) and uses its own stretched Monte Carlo settings. Those numbers are invented for the presentation.

Works Cited

AAA. Your Driving Costs 2024. American Automobile Association, Sept. 2024, https://newsroom.aaa.com/2024/09/your-driving-costs-2024/.

Board of Governors of the Federal Reserve System. Consumer Credit – G.19. 2024, https://www.federalreserve.gov/releases/g19/current/.

Board of Governors of the Federal Reserve System. Economic Well-Being of U.S. Households (SHED). 2024, https://www.federalreserve.gov/publications/report-economic-well-being-us-households.htm.

Damodaran, Aswath. Historical Returns on Stocks, Bonds and Bills: 1928–2024. NYU Stern School of Business, 2025, https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html.

Federal Deposit Insurance Corporation. National Rates and Rate Caps. 2024, https://www.fdic.gov/national-rates-and-rate-caps.

Federal Student Aid. Interest Rates and Fees for Federal Student Loans. U.S. Department of Education, 2024, https://studentaid.gov/understand-aid/types/loans/interest-rates.

HealthCare.gov. "Out-of-Pocket Maximum/Limit." Centers for Medicare and Medicaid Services, https://www.healthcare.gov/glossary/out-of-pocket-maximum-limit/.

Hull, John C. Options, Futures, and Other Derivatives. 11th ed., Pearson, 2021.

Internal Revenue Service. "IRS Provides Tax Inflation Adjustments for Tax Year 2024." 9 Nov. 2023, https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024.

KFF. 2024 Employer Health Benefits Survey. Kaiser Family Foundation, Oct. 2024, https://www.kff.org/health-costs/report/2024-employer-health-benefits-survey/.

Social Security Administration. "Contribution and Benefit Base." Office of the Chief Actuary, https://www.ssa.gov/oact/cola/cbb.html.

U.S. Bureau of Labor Statistics. Consumer Expenditure Surveys. https://www.bls.gov/cex/.

U.S. Bureau of Labor Statistics. Job Openings and Labor Turnover Survey (JOLTS). https://www.bls.gov/jlt/.

U.S. Bureau of Labor Statistics. The Employment Situation. https://www.bls.gov/news.release/empsit.toc.htm.
