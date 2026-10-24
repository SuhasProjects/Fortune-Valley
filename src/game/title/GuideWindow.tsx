import { useRef, useState, type KeyboardEvent } from 'react'
import type { BuildingId } from '@/types/domain'
import { BuildingPortrait } from '@/game/art/Sprite'
import { TitleModal } from './contracts'

const tabs = ['How to play', 'The town', 'Controls', 'FAQ', 'About'] as const
const steps = [
  ['Set the scene', 'Choose a starting life. Your town begins with a fictional income, living costs, savings, and debt.'],
  ['Build your strategy', 'Open a building to explore your options. Set a savings habit, adjust spending, or choose insurance.'],
  ['Move time forward', 'Advance a month. Pay arrives, bills are paid, investments change, and unexpected events can happen.'],
  ['Look at alternate futures', 'Finish when you are ready. Compare your played outcome with 1,000 paths using your strategy.'],
]
const buildings: [BuildingId, string, string][] = [
  ['bank', 'Pine Bank', 'Explore savings, debt payments, and the money you keep available.'],
  ['office', 'Town Office', 'See your pay, illustrative withholding, and employment changes.'],
  ['home', 'Your Home', 'Review housing and everyday spending as your life moves forward.'],
  ['hospital', 'Health House', 'Explore premiums, deductibles, and what happens after a covered event.'],
  ['market', 'Market Hall', 'Choose contributions and allocations, then watch returns unfold over time.'],
]
const questions = [
  ['Do I need an account?', 'No. You can start playing right away. Your saved story stays on this device.'],
  ['Is any real money involved?', 'No. Every balance, paycheck, investment, and payment belongs to a fictional simulation. No bank connection is needed.'],
  ['Can I play at my own pace?', 'Yes. Advance one month when you are ready, or use automatic play. Pause to review your choices.'],
  ['What if AI is unavailable?', 'The starting lives work offline. Personal questions and narrative opportunities have clearly labeled local fallbacks.'],
  ['Will this tell me the right financial decision?', 'The game helps you explore trade-offs and uncertainty. It does not provide personal financial advice or guarantee an outcome.'],
]

export function GuideWindow({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (next === null) return
    event.preventDefault(); setTab(next); refs.current[next]?.focus()
  }
  return <TitleModal title="Guide" onClose={onClose} width="lg">
    <div className="fv-guide-tabs" role="tablist" aria-label="Guide chapters">{tabs.map((name, index) => <button type="button" className="pixel-button" ref={element => { refs.current[index] = element }} key={name} role="tab" id={`fv-guide-tab-${index}`} aria-controls="fv-guide-page" aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} onKeyDown={event => navigate(event, index)} onClick={() => setTab(index)}>{name}</button>)}</div>
    <div role="tabpanel" id="fv-guide-page" aria-labelledby={`fv-guide-tab-${tab}`} tabIndex={0} className="fv-guide-page">
      {tab === 0 && <ol>{steps.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>}
      {tab === 1 && buildings.map(([building, title, text]) => <article key={building}><BuildingPortrait building={building}/><h3>{title}</h3><p>{text}</p></article>)}
      {tab === 2 && <dl className="fv-shortcuts">{[['Space', 'Pause or resume'], ['N', 'Next month'], ['1–5', 'Open a building'], ['T', 'Timeline'], ['A', 'Activity'], ['Esc', 'Close a window or open the pause menu'], ['?', 'Guide']].map(([key, label]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></div>)}</dl>}
      {tab === 3 && questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      {tab === 4 && <><h3>Fortune Valley</h3><p>A little town. A bigger perspective.</p><p>Fictional educational simulation. Assumptions are illustrative. For learning, not personal financial advice.</p><p>All returns, event probabilities, and financial assumptions are illustrative. These are learning scenarios, not forecasts.</p></>}
    </div>
  </TitleModal>
}
