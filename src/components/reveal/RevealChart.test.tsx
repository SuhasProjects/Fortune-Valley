// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RevealChart } from './RevealChart';
import { fixtureConfig, fixtureFinishedState, fixtureMonteCarlo } from '@/fixtures';
import { compareWithBaseline } from '@/engine';

afterEach(cleanup);

describe('RevealChart', () => {
  it('renders only engine-computed figures, labels the percentile honestly, and shows the paired comparison', () => {
    const comparison = compareWithBaseline(fixtureConfig, fixtureFinishedState.policyLog, fixtureMonteCarlo.months, { paths: 50 });
    const payload = { config: fixtureConfig, finalState: fixtureFinishedState, policyLog: fixtureFinishedState.policyLog, monteCarlo: { ...fixtureMonteCarlo, comparison }, explanation: { text: 'Template text.', source: 'fallback' as const } };
    render(<RevealChart payload={payload} />);
    expect(screen.getByText(/Same strategy, 300 futures/)).toBeTruthy();
    expect(screen.getByText(/not a grade/)).toBeTruthy();
    expect(screen.getByText(/Same luck, different choices/)).toBeTruthy();
    expect(screen.getByText(/Offline explanation/)).toBeTruthy();
    expect(screen.getByText('Table view: net worth bands by month')).toBeTruthy();
    const median = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fixtureMonteCarlo.median);
    expect(screen.getAllByText(median).length).toBeGreaterThan(0);
  });
});
