// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { applyAction, createGame } from '../../engine';
import { scenarios } from '../../data/scenarios';
import { useGameStore } from '../../stores/useGameStore';
import type { BuildingId, GameEvent } from '../../types/domain';
import { buildings } from '../town/buildings';
import { BuildingWindow } from './BuildingWindow';
import { KEEPER_LINES } from './KeeperGreeting';

const initialStore = useGameStore.getState();
const eventFor = (building: BuildingId, type: 'A' | 'B' = 'A'): GameEvent => ({
  id: `${building}-${type}`, buildingTarget: building, type, title: `${building} notice`,
  body: 'A town notice.', source: 'engine', createdAtMonth: 0,
  options: [{ id: 'acknowledge', label: 'Acknowledge notice', description: 'Dismiss this notice.', effect: { template: 'none' } }],
});
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  useGameStore.setState({ game: applyAction(createGame(scenarios[1]!), { type: 'resume' }).state });
});
afterEach(() => { cleanup(); useGameStore.setState(initialStore, true); vi.restoreAllMocks(); });

describe('BuildingWindow public contract', () => {
  it.each(['bank', 'office', 'hospital', 'home', 'market'] as const)('names the %s dialog and closes through the supplied handler', building => {
    const onClose = vi.fn();
    render(<BuildingWindow building={building} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: buildings[building].title });
    expect(within(dialog).getByRole('region', { name: 'Decision' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('shows only this buildingÃ¢â‚¬â„¢s events and dispatches their original IDs', () => {
    const game = useGameStore.getState().game!;
    const dispatch = vi.fn();
    useGameStore.setState({ game: { ...game, activeEvents: [eventFor('bank'), eventFor('home')] }, dispatchAction: dispatch });
    render(<BuildingWindow building="bank" onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'bank notice' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'home notice' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge notice' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'apply_event_option', eventId: 'bank-A', optionId: 'acknowledge' });
  });
  it('leaves Office job offers in OfficePanel without a duplicate event card', () => {
    const game = useGameStore.getState().game!;
    const offer = eventFor('office', 'B');
    offer.title = 'Library offer';
    offer.options = [{ id: 'accept', label: 'Accept', description: 'Librarian', effect: { template: 'offer_job', title: 'Librarian', grossAnnualSalary: 80000 } }];
    useGameStore.setState({ game: { ...game, activeEvents: [offer, eventFor('office')] } });
    const view = render(<BuildingWindow building="office" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Accept offer' })).toBeTruthy();
    expect(view.container.querySelectorAll('.event-card')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'office notice' })).toBeTruthy();
  });
  it('does not open a window without a game', () => {
    useGameStore.setState({ game: null });
    render(<BuildingWindow building="bank" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// These cover the new presentation's data boundaries, without re-testing the engine.
describe('keeper and notice presentation', () => {
  it('chooses a short static keeper line by month', () => {
    const game = useGameStore.getState().game!;
    useGameStore.setState({ game: { ...game, monthIndex: 3 } });
    render(<BuildingWindow building="bank" onClose={vi.fn()} />);
    expect(screen.getByText(KEEPER_LINES.bank[1]!)).toBeTruthy();
    for (const lines of Object.values(KEEPER_LINES)) for (const line of lines) {
      expect(line.length).toBeLessThan(70);
      expect(line).not.toMatch(/\d/);
    }
  });
  it('renders shock receipt values and option descriptions directly from the event', () => {
    const game = useGameStore.getState().game!;
    const event = eventFor('hospital');
    event.shock = { kind: 'medical', grossCost: 5000, insurerPaid: 3200, outOfPocket: 1800, planId: 'health_plus', fundedFrom: [] };
    useGameStore.setState({ game: { ...game, activeEvents: [event] } });
    render(<BuildingWindow building="hospital" onClose={vi.fn()} />);
    const notice = screen.getByRole('region', { name: 'hospital notice' });
    for (const value of ['$5,000', '$3,200', '$1,800']) expect(within(notice).getByText(value)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acknowledge notice' }).getAttribute('aria-describedby')).toBe('event-hospital-A-acknowledge-description');
    expect(document.getElementById('event-hospital-A-acknowledge-description')?.textContent).toBe('Dismiss this notice.');
  });
});
