/**
 * applyAction: validates and applies a GameAction without mutating the input.
 * Invalid actions return { ok:false } with the ORIGINAL state. Owner: Agent 1.
 */
import type { ActionErrorCode, ActionResult, GameAction, GameState, TimelineEntry } from '@/types/domain';
import { makeId, netWorthOf, post, round2 } from './accounting';
import { applyEffect, describeEffect } from './events';
import { isFiniteNonNeg, validateAllocation, validateCar, validatePlanId, validateNarrativeEvent } from './validation';
import { describeCar, carRunningCost } from './car';
import { BOUNDS } from '@/config/defaults';

const reject = (state: GameState, code: ActionErrorCode, message: string): ActionResult => ({ ok: false, code, message, state });

function logPolicy(s: GameState, action: GameAction, type: TimelineEntry['type'], description: string, extra?: Partial<TimelineEntry>, resolvedEffect?: Parameters<typeof applyEffect>[1], contextStatus?: GameState['employment']['status']) {
  action = structuredClone(action);
  resolvedEffect = resolvedEffect ? structuredClone(resolvedEffect) : undefined;
  s.policyLog.push(resolvedEffect ? { monthIndex: s.monthIndex, action, resolvedEffect, context: { employmentStatus: contextStatus ?? s.employment.status } } : { monthIndex: s.monthIndex, action });
  s.timeline.push({ id: makeId('T', s, s.timeline.length), monthIndex: s.monthIndex, type, description, action, netWorthAfter: netWorthOf(s), ...extra });
}

export function applyAction(input: GameState, action: GameAction): ActionResult {
  if (input.status === 'finished' && action.type !== 'mark_notifications_read') return reject(input, 'game_finished', 'Game is finished');
  const s: GameState = structuredClone(input);

  switch (action.type) {
    case 'advance_month':
      // Handled by advanceMonth(); kept in the union so stores can dispatch uniformly.
      return reject(input, 'invalid_status', 'Use advanceMonth(state) for advance_month');

    case 'pause':
      if (s.status !== 'playing') return reject(input, 'invalid_status', `Cannot pause while ${s.status}`);
      s.status = 'paused';
      return { ok: true, state: s };
    case 'resume':
      if (s.status !== 'paused' && s.status !== 'setup') return reject(input, 'invalid_status', `Cannot resume while ${s.status}`);
      s.status = 'playing';
      return { ok: true, state: s };
    case 'finish':
      s.status = 'finished';
      s.timeline.push({ id: makeId('T', s, s.timeline.length), monthIndex: s.monthIndex, type: 'milestone', description: 'Run finished', netWorthAfter: netWorthOf(s) });
      return { ok: true, state: s };
    case 'mark_notifications_read':
      s.notifications = s.notifications.map((n) => (n.read ? n : { ...n, read: true }));
      return { ok: true, state: s };

    case 'set_allocation': {
      const v = validateAllocation(action.allocation);
      if (!v.ok) return reject(input, 'invalid_allocation', v.message);
      s.policy = { ...s.policy, targetAllocation: { ...action.allocation } };
      logPolicy(s, action, 'policy_change', `Target allocation → stock ${(action.allocation.stock * 100).toFixed(0)}% / bond ${(action.allocation.bond * 100).toFixed(0)}% / ETF ${(action.allocation.etf * 100).toFixed(0)}%`);
      return { ok: true, state: s };
    }
    case 'set_budget': {
      if (!isFiniteNonNeg(action.discretionaryMonthly) || action.discretionaryMonthly > BOUNDS.monthlySpendMax) return reject(input, 'invalid_amount', 'Discretionary budget must be a non-negative amount');
      s.household = { ...s.household, discretionaryMonthly: round2(action.discretionaryMonthly) };
      logPolicy(s, action, 'policy_change', `Discretionary budget → $${action.discretionaryMonthly.toLocaleString()}/mo`);
      return { ok: true, state: s };
    }
    case 'set_housing': {
      const err = applyEffect(s, { template: 'change_housing', housingMonthly: action.housingMonthly, housingKind: action.housingKind });
      if (err) return reject(input, 'invalid_amount', err);
      logPolicy(s, action, 'choice', `Housing → ${action.housingKind} at $${action.housingMonthly.toLocaleString()}/mo`);
      return { ok: true, state: s };
    }
    case 'set_car': {
      const car = { owned: action.owned, valueBand: action.valueBand };
      const v = validateCar(car, s.debts);
      if (!v.ok) return reject(input, 'invalid_amount', v.message);
      s.car = car;
      if (!car.owned && s.insurance.auto !== null) { // no car → nothing to insure; the plan is dropped with it
        s.insurance = { ...s.insurance, auto: null };
        s.policy = { ...s.policy, insurancePlanIds: { ...s.policy.insurancePlanIds, auto: null } };
      }
      logPolicy(s, action, 'choice', car.owned ? `Car → ${describeCar(car)}, about $${carRunningCost(car.valueBand).toLocaleString()}/mo to run` : 'Car → none (auto cover dropped)');
      return { ok: true, state: s };
    }
    case 'set_insurance': {
      const v = validatePlanId(s.assumptions, action.line, action.planId);
      if (!v.ok) return reject(input, 'unknown_plan', v.message);
      const err = applyEffect(s, { template: 'change_insurance', line: action.line, planId: action.planId });
      if (err) return reject(input, 'invalid_status', err);
      const plan = s.assumptions.insurancePlans.find((p) => p.id === action.planId);
      logPolicy(s, action, 'policy_change', `${action.line} insurance → ${plan ? plan.name : 'no coverage'}`);
      return { ok: true, state: s };
    }
    case 'set_contributions': {
      if (!isFiniteNonNeg(action.savingsContributionPerMonth) || !isFiniteNonNeg(action.investmentContributionPerMonth)) return reject(input, 'invalid_amount', 'Contributions must be non-negative');
      if (action.savingsContributionPerMonth > BOUNDS.contributionMax || action.investmentContributionPerMonth > BOUNDS.contributionMax) return reject(input, 'invalid_amount', 'Contribution exceeds maximum');
      s.policy = { ...s.policy, savingsContributionPerMonth: round2(action.savingsContributionPerMonth), investmentContributionPerMonth: round2(action.investmentContributionPerMonth) };
      logPolicy(s, action, 'policy_change', `Contributions → save $${action.savingsContributionPerMonth}/mo, invest $${action.investmentContributionPerMonth}/mo`);
      return { ok: true, state: s };
    }
    case 'set_extra_debt_payment': {
      if (!isFiniteNonNeg(action.amount) || action.amount > BOUNDS.contributionMax) return reject(input, 'invalid_amount', 'Extra payment must be a non-negative amount');
      s.policy = { ...s.policy, extraDebtPaymentPerMonth: round2(action.amount) };
      logPolicy(s, action, 'policy_change', `Extra debt payment → $${action.amount}/mo`);
      return { ok: true, state: s };
    }
    case 'set_min_cash_buffer': {
      if (!isFiniteNonNeg(action.amount) || action.amount > BOUNDS.cashMax) return reject(input, 'invalid_amount', 'Cash buffer must be a non-negative amount');
      s.policy = { ...s.policy, minCashBuffer: round2(action.amount) };
      logPolicy(s, action, 'policy_change', `Cash buffer → $${action.amount}`);
      return { ok: true, state: s };
    }
    case 'make_extra_payment': {
      if (!isFiniteNonNeg(action.amount) || action.amount <= 0) return reject(input, 'invalid_amount', 'Payment must be positive');
      const d = s.debts.find((x) => x.id === action.debtId);
      if (!d) return reject(input, 'unknown_debt', `Unknown debt ${action.debtId}`);
      const amt = round2(Math.min(action.amount, d.balance));
      if (amt > s.cash) return reject(input, 'insufficient_funds', `Only $${s.cash.toLocaleString()} cash available`);
      post(s, 'cash', 'debt_payment', -amt, `Extra payment to ${d.name}`);
      post(s, `debt:${d.id}`, 'debt_payment', -amt, `Extra payment to ${d.name}`);
      logPolicy(s, action, 'choice', `Paid $${amt.toLocaleString()} extra toward ${d.name}`);
      return { ok: true, state: s };
    }
    case 'transfer': {
      if (!isFiniteNonNeg(action.amount) || action.amount <= 0) return reject(input, 'invalid_amount', 'Transfer must be positive');
      if (action.from === action.to) return reject(input, 'invalid_amount', 'Transfer accounts must differ');
      const available = action.from === 'cash' ? s.cash : s.savings;
      if (action.amount > available) return reject(input, 'insufficient_funds', `Only $${available.toLocaleString()} available in ${action.from}`);
      post(s, action.from, 'transfer', -action.amount, `Transfer to ${action.to}`);
      post(s, action.to, 'transfer', action.amount, `Transfer from ${action.from}`);
      logPolicy(s, action, 'choice', `Moved $${action.amount.toLocaleString()} from ${action.from} to ${action.to}`);
      return { ok: true, state: s };
    }
    case 'enqueue_event': {
      const ev = action.event;
      const eventValidation = validateNarrativeEvent(s.assumptions, ev, s.monthIndex);
      if (!eventValidation.ok) return reject(input, 'invalid_effect', eventValidation.message);
      if (s.activeEvents.some((e) => e.id === ev.id)) return reject(input, 'duplicate_event', `Event ${ev.id} already active`);
      for (const o of ev.options) {
        const err = applyEffect(structuredClone(s), o.effect, true); // dry-run validation
        if (err) return reject(input, 'invalid_effect', `Option ${o.id}: ${err}`);
      }
      s.activeEvents.push(structuredClone(ev));
      s.notifications.push({ id: makeId('N', s, s.notifications.length), monthIndex: s.monthIndex, kind: 'decision', summary: ev.title, details: ev.body, relatedBuilding: ev.buildingTarget, read: false });
      return { ok: true, state: s };
    }
    case 'dismiss_event': {
      const ev = s.activeEvents.find((e) => e.id === action.eventId);
      if (!ev) return reject(input, 'unknown_event', `Unknown event ${action.eventId}`);
      s.activeEvents = s.activeEvents.filter((e) => e.id !== action.eventId);
      if (ev.type === 'B') logPolicy(s, action, 'choice', `Declined: ${ev.title}`, { eventId: ev.id });
      return { ok: true, state: s };
    }
    case 'apply_event_option': {
      const ev = s.activeEvents.find((e) => e.id === action.eventId);
      if (!ev) return reject(input, 'unknown_event', `Unknown event ${action.eventId}`);
      if (ev.expiresAtMonth !== undefined && s.monthIndex > ev.expiresAtMonth) return reject(input, 'event_expired', 'This opportunity has expired');
      const opt = ev.options.find((o) => o.id === action.optionId);
      if (!opt) return reject(input, 'unknown_option', `Unknown option ${action.optionId}`);
      const statusBefore = s.employment.status;
      const err = applyEffect(s, opt.effect);
      if (err) return reject(input, 'invalid_effect', err);
      s.activeEvents = s.activeEvents.filter((e) => e.id !== action.eventId);
      if (ev.type === 'B' || opt.effect.template !== 'none') {
        logPolicy(s, action, ev.source === 'engine' ? 'choice' : 'ai_event', `${ev.title}: ${opt.label} — ${describeEffect(opt.effect)}`, { eventId: ev.id }, opt.effect, statusBefore);
        const logged = s.policyLog[s.policyLog.length - 1]!;
        logged.label = `${ev.title}: ${opt.label}`;
        logged.alternatives = ev.options.filter((o) => o.id !== opt.id).map((o) => ({ optionId: o.id, label: o.label, effect: structuredClone(o.effect) }));
      }
      return { ok: true, state: s };
    }
  }
}
