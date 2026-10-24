import { createGame, debtTotal } from '@/engine'
import { scenarioCards, scenarios } from '@/data/scenarios'
import { usd } from '@/components/flow/format'
import { useGameStore } from '@/stores/useGameStore'
import { MenuButton } from './contracts'

const cards = scenarios.map((config, index) => {
  const state = createGame(config)
  return { config, description: scenarioCards[index]!.description, salary: state.employment.grossAnnualSalary, cash: state.cash, debt: debtTotal(state) }
})

export function StoryPicker() {
  const startGame = useGameStore(state => state.startGame)
  return <section aria-labelledby="fv-picker-heading" className="fv-picker">
    <header><h2 id="fv-picker-heading" tabIndex={-1}>Every life starts somewhere.</h2><p>Choose a fictional life. Make it your own.</p></header>
    <div className="fv-story-grid">{cards.map(({ config, description, salary, cash, debt }, index) =>
      <MenuButton key={config.scenarioId} className="fv-story-card" onClick={() => startGame(config)}>
        <span className={`fv-portrait fv-portrait--${index}`} aria-hidden="true"/>
        <strong>{config.title}</strong><span className="fv-story-description">{description}</span>
        <span className="fv-story-facts"><span>Yearly salary <b>{usd(salary)}</b></span><span>Starting cash <b>{usd(cash)}</b></span><span>Total debt <b>{usd(debt)}</b></span></span>
        <span className="fv-story-start">Begin this story</span>
      </MenuButton>)}</div>
  </section>
}
