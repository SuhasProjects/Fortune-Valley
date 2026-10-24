import type { BuildingId, GameState } from '../../types/domain'
import { usd } from '../flow'
import { PixelIcon } from './PixelArt'

// Read-only shell fallback until the controlled building panels are supplied.
export function BuildingOverview({ building, game }: { building: BuildingId; game: GameState }) {
  const rows: Record<BuildingId, [string, string][]> = {
    bank: [['Cash on hand', usd(game.cash)], ['Savings balance', usd(game.savings)], ['Monthly savings goal', usd(game.policy.savingsContributionPerMonth)], ...game.debts.map(debt => [debt.name, usd(debt.balance)] as [string,string])],
    office: [['Your role', game.employment.title], ['Employment', game.employment.status], ['Annual salary (before tax)', usd(game.employment.grossAnnualSalary)], ['Tax filing', game.taxProfile.filingStatus.replaceAll('_', ' ')]],
    home: [['Housing / month', usd(game.household.housingMonthly)], ['Essentials / month', usd(game.household.essentialsMonthly)], ['Lifestyle / month', usd(game.household.discretionaryMonthly)], ['Dependents', String(game.household.dependents)]],
    market: [['Stock holdings', usd(game.investments.stock)], ['Bond holdings', usd(game.investments.bond)], ['Diversified ETF', usd(game.investments.etf)], ['Monthly contribution', usd(game.policy.investmentContributionPerMonth)]],
    hospital: Object.entries(game.insurance).map(([line, id]) => [line, game.assumptions.insurancePlans.find(plan => plan.id === id)?.name ?? 'No plan selected']),
  }
  return <section className="overview-book"><div className="overview-title"><PixelIcon kind={building === 'market' ? 'leaf' : 'book'}/><div><span className="eyebrow">YOUR TOWN JOURNAL</span><h3>At a glance</h3></div></div><dl className="journal-values">{rows[building].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="journal-note">These are your current balances and settings. Advance a month to see how your story changes.</p></section>
}
