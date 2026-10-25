import { describe, expect, it } from 'vitest';
import { fixtureConfig, fixtureFinishedState, fixtureMonteCarlo, fixtureState } from '@/fixtures';
import { summarizeForAi } from '@/engine';
import { classifyQuestion, fallbackExplanation, fmtUsd, type ExplainTopic } from '@/services/aiFallback';
import { explainOutcome } from '@/services/aiClient';
import type { StateSummary } from '@/types/domain';

const finished = () => summarizeForAi(fixtureFinishedState, fixtureConfig.narrativeFocus, 'entry_worker');
const midGame = () => summarizeForAi(fixtureState, fixtureConfig.narrativeFocus, 'entry_worker');
const mc = {
  median: fixtureMonteCarlo.median,
  p10: fixtureMonteCarlo.p10,
  p90: fixtureMonteCarlo.p90,
  probabilityNegativeNetWorth: fixtureMonteCarlo.probabilityNegativeNetWorth,
  probabilityLiquidityShortfall: fixtureMonteCarlo.probabilityLiquidityShortfall,
  observedNetWorth: fixtureMonteCarlo.observedNetWorth,
  percentileOfObserved: fixtureMonteCarlo.percentileOfObserved,
};
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z"])/).filter((s) => s.trim().length > 0);
const DISCLAIMER = 'Demo figures are illustrative, not personal advice.';

const QUESTIONS: Record<ExplainTopic, string[]> = {
  savings: ['How did my savings do?', 'Was my emergency fund big enough?', 'why did I run low on cash'],
  debt: ['What about my debt?', 'Did the student loan interest matter?', 'should my credit card be paid off'],
  investing: ['Were my investments worth it?', 'What did the stock market do to me?', 'Was my allocation ok'],
  insurance: ['Did insurance help?', 'Was the deductible too high?', 'What about health coverage'],
  spending: ['Was my rent too high?', 'did I spend too much', 'Is my budget reasonable'],
  advice: ['What should I do?', 'What should I change next time?', 'Any advice for me?'],
  general: ['What do these results mean?', '', 'tell me about the lines'],
};

describe('fallbackExplanation', () => {
  it('classifies free-text questions into template families', () => {
    for (const [topic, qs] of Object.entries(QUESTIONS) as [ExplainTopic, string[]][]) {
      for (const q of qs) expect(classifyQuestion(q), q).toBe(topic);
    }
    // Advice framing wins over topic words: "what should I do about my debt" is a request for advice.
    expect(classifyQuestion('What should I do about my debt?')).toBe('advice');
  });

  it('explains the endings with the numbers it is given and ends with the short note', () => {
    const text = fallbackExplanation(finished(), mc, 'What do these results mean?');
    expect(text).toContain('1,000 replays');
    expect(text.startsWith('Across 1,000 replays')).toBe(true);
    expect(DISCLAIMER.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(text).toContain('what-if panel');
    expect(text).toMatch(/unlucky \(10th percentile\)/i);
    expect(text).toMatch(/median ending net worth/i);
    expect(text).toMatch(/lucky \(90th percentile\)/i);
    expect(text).toContain(fmtUsd(mc.p10));
    expect(text).toContain(fmtUsd(mc.median));
    expect(text).toContain(fmtUsd(mc.p90));
    expect(text).toContain(fmtUsd(mc.observedNetWorth));
    expect(text).toContain(`${Math.round(mc.probabilityNegativeNetWorth * 100)}% of replays ended with negative net worth`);
    expect(text).toContain(`${Math.round(mc.probabilityLiquidityShortfall * 100)}% needed emergency borrowing`);
    expect(text).toContain('not a grade');
    expect(text.endsWith(DISCLAIMER)).toBe(true);
  });

  it('produces 4–7 clean sentences for every question category, with and without Monte Carlo numbers', () => {
    for (const qs of Object.values(QUESTIONS)) {
      for (const q of qs) {
        for (const [summary, m] of [[finished(), mc], [midGame(), undefined]] as const) {
          const text = fallbackExplanation(summary, m, q);
          const n = sentences(text).length;
          expect(n, `${q}: ${text}`).toBeGreaterThanOrEqual(4);
          expect(n, `${q}: ${text}`).toBeLessThanOrEqual(7);
          // Answers never open by refusing; general levers always carry a trade-off and a what-if pointer.
          expect(text).not.toMatch(/^(The|This) simulation can(not|'t)|^I can(not|'t)/);
          expect(text).toMatch(/but|at the cost|trade-off|while/);
          expect(text).toContain('what-if panel');
          expect(text).not.toMatch(/NaN|undefined|null|\$-|Infinity/);
          expect(text).not.toMatch(/\byou should\b|\bI recommend\b|\bguarantee/i);
          expect(text.length).toBeGreaterThan(200);
          expect(text.length).toBeLessThan(1200);
          expect(text.endsWith(DISCLAIMER)).toBe(true);
        }
      }
    }
  });

  it('answers each topic with that topic’s own figures from the summary', () => {
    const s = finished();
    const savings = fallbackExplanation(s, mc, 'How did my savings do?');
    expect(savings).toContain(fmtUsd(s.cash));
    expect(savings).toContain(fmtUsd(s.savings));
    expect(savings).toContain(`${fmtUsd(s.policy.savingsContributionPerMonth)}/mo`);

    const debt = fallbackExplanation(s, mc, 'What about my debt?');
    if (s.debtTotal > 0) expect(debt).toContain(fmtUsd(s.debtTotal));
    else expect(debt).toMatch(/no debt/);

    const investing = fallbackExplanation(s, mc, 'Were my investments worth it?');
    expect(investing).toContain(fmtUsd(s.investmentsTotal));
    expect(investing).toContain(`${Math.round(s.policy.targetAllocation.stock * 100)}% stock`);
    expect(investing).toContain(fmtUsd(mc.p90));

    const insurance = fallbackExplanation(s, mc, 'Did insurance help?');
    expect(insurance).toMatch(/Basic Health|Plus Health|Family Health|no health plan/);
    expect(insurance).toContain(`${Math.round(mc.probabilityLiquidityShortfall * 100)}% of replays needed emergency borrowing`);

    const spending = fallbackExplanation(s, mc, 'Was my rent too high?');
    expect(spending).toContain(`${fmtUsd(s.housingMonthly)} on housing`);
    expect(spending).toContain(`${fmtUsd(s.essentialsMonthly)} on essentials`);
    expect(spending).toContain(`${fmtUsd(s.grossAnnualSalary)}/yr`);

    const advice = fallbackExplanation(s, mc, 'What should I do?');
    expect(advice.startsWith('The levers that usually matter most')).toBe(true);
    expect(advice).not.toMatch(/cannot (tell|say|decide)/);
    expect(advice).toContain('highest-rate debt first');
    expect(advice).toContain('3–6 months');
    expect(advice).toContain('what-if panel');

    // A follow-up question is answered directly with the general principle and its trade-off.
    const volatile = fallbackExplanation(s, mc, 'what is the best way to be less volatile');
    expect(volatile).not.toMatch(/^(The|This) simulation can(not|'t)/);
    expect(volatile).toMatch(/higher bond share usually narrows the spread .* but lowers the typical one/);
    expect(volatile).toContain(fmtUsd(mc.p90));
    expect(volatile).toContain('what-if panel');
  });

  it('is deterministic and formats negative and missing percentile values cleanly', () => {
    const s = finished();
    expect(fallbackExplanation(s, mc, 'debt')).toBe(fallbackExplanation(s, mc, 'debt'));
    const grim = { ...mc, p10: -8400.4, median: -171, p90: 2000, observedNetWorth: -171, percentileOfObserved: undefined, probabilityNegativeNetWorth: 0.54, probabilityLiquidityShortfall: 0.06 };
    const text = fallbackExplanation(s, grim, 'What do these results mean?');
    expect(text).toContain('-$8,400');
    expect(text).toContain('-$171');
    expect(text).toContain('54% of replays ended with negative net worth');
    expect(text).not.toMatch(/NaN|undefined|\$-/);
    expect(text).toMatch(/not a grade/);
    // Out-of-range or non-finite inputs never leak into the text.
    const broken = { ...mc, percentileOfObserved: Number.NaN, probabilityNegativeNetWorth: 1.7 };
    expect(fallbackExplanation(s, broken, 'why')).not.toMatch(/NaN|undefined|170%/);
  });

  it('mid-game insight (no Monte Carlo) opens with the current snapshot instead of endings', () => {
    const s = midGame();
    const text = fallbackExplanation(s, undefined, 'Is my budget reasonable');
    expect(text).toContain(`As of ${s.monthLabel}`);
    expect(text).toContain(fmtUsd(s.netWorth));
    expect(text).not.toContain('1,000 replays');
    expect(text).toContain(`${fmtUsd(s.discretionaryMonthly)} on everything else`);
    expect(text.endsWith(DISCLAIMER)).toBe(true);
  });

  it('is what the offline client returns, keyed on the player’s question', async () => {
    const r = await explainOutcome(finished(), 'What should I do?', fixtureMonteCarlo, { offline: true });
    expect(r.source).toBe('fallback');
    expect(r.text).toContain('highest-rate debt first');
    expect(r.text).not.toMatch(/cannot tell you what to do/);
    expect(r.text).toContain(fmtUsd(fixtureMonteCarlo.median));
  });

  it('never mutates the summary it is given', () => {
    const s: StateSummary = finished();
    const snapshot = JSON.stringify(s);
    fallbackExplanation(s, mc, 'insurance');
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
