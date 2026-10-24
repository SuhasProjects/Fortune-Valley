import { useState } from 'react'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'
import { TownIllustration } from './TownIllustration'

const lifeDescriptions = [
  'Balance study costs, everyday spending, and early debt.',
  'Put your income to work while building a financial cushion.',
  'Explore investing, bigger commitments, and long-term goals.',
  'Plan for household costs and the unexpected.',
]
const steps = [
  { title: 'Choose a starting point', text: 'Pick a fictional starting life or explore a question of your own.' },
  { title: 'Make everyday choices', text: 'Visit the town to manage spending, savings, debt, and insurance. Move forward one month at a time.' },
  { title: 'See the bigger picture', text: 'Review your decisions across 1,000 simulated paths to see how different outcomes can unfold.' },
]

/** Public landing page. Account controls are intentionally disabled placeholders. */
export function Landing() {
  const [howOpen, setHowOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [formError, setFormError] = useState('')
  const store = useGameStore()

  return <main className="welcome-page" id="top">
    <a className="welcome-skip" href="#welcome-content">Skip to content</a>
    <header className="welcome-header">
      <a className="welcome-brand" href="#top" aria-label="Financial Town home">
        <span className="welcome-logo" aria-hidden="true">FT</span>
        <span>Financial Town<small>A space to learn about money</small></span>
      </a>
      <nav className="welcome-nav" aria-label="Main navigation">
        <button type="button" className="welcome-nav-link" aria-expanded={howOpen} aria-controls="how-it-works" onClick={() => { setHowOpen(open => !open); if (!howOpen) document.getElementById('top')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>How it works</button>
        <a className="welcome-nav-link" href="#starting-lives">Starting lives</a>
        <a className="welcome-nav-link" href="#town-guide">The town</a><a className="welcome-nav-link" href="#questions">FAQs</a>
      </nav>
      <div className="welcome-accounts">
        <div><button type="button" disabled aria-describedby="account-placeholder">Sign in</button><button type="button" className="welcome-account-create" disabled aria-describedby="account-placeholder">Create account</button></div>
        <small id="account-placeholder">Account features coming soon</small>
      </div>
    </header>

    <div id="how-it-works" className={`welcome-how ${howOpen ? 'is-open' : ''}`} aria-hidden={!howOpen} inert={!howOpen}>
      <div className="welcome-how-inner"><section aria-label="How Financial Town works"><div className="welcome-section-label">A simple way to learn</div><div className="welcome-steps">{steps.map((step, i) => <article key={step.title}><span className="welcome-step-number">0{i + 1}</span><h2>{step.title}</h2><p>{step.text}</p></article>)}</div><p className="welcome-how-note">No account or real money needed. You can start with a fictional life right away.</p></section></div>
    </div>

    <section className="welcome-hero" id="welcome-content" aria-labelledby="welcome-title">
      <div className="welcome-hero-copy"><span className="welcome-section-label">Learn by making choices</span><h1 id="welcome-title">Small choices.<br/>A clearer financial future.</h1><p>Get comfortable with money, one decision at a time. Explore everyday trade-offs in a simple, interactive town.</p><div className="welcome-hero-actions"><a className="welcome-button welcome-button-primary" href="#starting-lives">Start playing</a><button className="welcome-button welcome-button-text" type="button" onClick={() => { setHowOpen(true); document.getElementById('how-it-works')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>See how it works</button></div><span className="welcome-hero-note">Free to explore. No account required.</span></div>
      <TownIllustration/>
    </section>

    <div className="welcome-benefits"><span>Everyday financial decisions</span><span>Learn at your own pace</span><span>See a range of outcomes</span></div>

    {store.savedGame && <section className="welcome-saved" aria-label="Saved game"><div><span className="welcome-section-label">Saved on this device</span><h2>Continue {store.savedGame.title}</h2><p>Pick up where you left off in month {store.savedGame.monthIndex}.</p></div><div><button type="button" className="welcome-button welcome-button-primary" onClick={() => store.loadSavedGame()}>Continue</button><button type="button" className="welcome-button welcome-button-text" onClick={store.clearSavedGame}>Delete save</button></div></section>}

    <section id="learn-to-play" className="welcome-section welcome-play-guide" aria-labelledby="play-guide-title">
      <div className="welcome-section-heading"><div><span className="welcome-section-label">How to play</span><h2 id="play-guide-title">Learn by living a little.</h2></div><p>No spreadsheets to set up.<br/>Just a starting life and a few choices.</p></div>
      <div className="welcome-play-steps">{[
        ['Set the scene', 'Choose a starting life. Your town begins with a fictional income, living costs, savings, and debt.'],
        ['Build your strategy', 'Open a building to explore your options. Set a savings habit, adjust spending, or choose insurance.'],
        ['Move time forward', 'Advance a month. Pay arrives, bills are paid, investments change, and unexpected events can happen.'],
        ['Look at alternate futures', 'Finish when you are ready. Compare your played outcome with 1,000 paths using your strategy.'],
      ].map(([title, text], i) => <article key={title}><span className="welcome-step-number">0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section id="town-guide" className="welcome-section welcome-town-guide" aria-labelledby="town-guide-title">
      <div className="welcome-section-heading"><div><span className="welcome-section-label">A town with a purpose</span><h2 id="town-guide-title">Five buildings. Connected choices.</h2></div><p>Click a building in the game<br/>to see what you can change.</p></div>
      <div className="welcome-building-grid">{[
        ['Bank', 'Build your buffer', 'Explore savings, debt payments, and the money you keep available.'],
        ['Office', 'Understand your income', 'See your pay, illustrative withholding, and employment changes.'],
        ['Home', 'Make room in your budget', 'Review housing and everyday spending as your life moves forward.'],
        ['Insurance', 'Plan for surprises', 'Explore premiums, deductibles, and what happens after a covered event.'],
        ['Market', 'Explore investing', 'Choose contributions and allocations, then watch returns unfold over time.'],
      ].map(([building, title, text], i) => <article key={building}><div className={`welcome-building-symbol welcome-building-symbol-${i}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none">{i === 0 ? <><path d="m6 17 18-9 18 9H6ZM10 21v17m9-17v17m10-17v17m9-17v17M5 40h38"/></> : i === 1 ? <><path d="M12 42V6h24v36M18 13h3m6 0h3m-12 8h3m6 0h3m-12 8h3m6 0h3M21 42v-7h6v7"/></> : i === 2 ? <><path d="m5 23 19-16 19 16M10 20v22h28V20M20 42V29h8v13"/></> : i === 3 ? <><path d="M24 6 39 12v12c0 9-15 18-15 18S9 33 9 24V12L24 6Z"/><path d="M24 17v14m-7-7h14"/></> : <><path d="M8 42V20h32v22M5 9h38l-3 11H8L5 9ZM15 28h10v9H15m16-9v14"/></>}</svg></div><span className="welcome-section-label">{building}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="welcome-month-section" aria-labelledby="month-title"><div><span className="welcome-section-label">The game moves with you</span><h2 id="month-title">Play a month.<br/>See what changes.</h2><p>Your settings carry forward, so a small choice can become a lasting habit. Pause to look closer or take the next step when you are ready.</p><a className="welcome-button welcome-button-primary" href="#starting-lives">Choose a starting life</a></div><div className="welcome-month-board"><div className="welcome-month-heading"><span>A month in Financial Town</span><span>Turn-based play</span></div>{[
      ['Income comes in', 'Pay and simplified withholding are recorded.'],
      ['Life gets paid for', 'Housing, bills, premiums, and debt payments come next.'],
      ['Your plan continues', 'Savings and investment contributions use available cash.'],
      ['The month unfolds', 'Returns and unexpected events can change the picture.'],
    ].map(([title, text], i) => <div className="welcome-month-row" key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}<p className="welcome-month-note">Routine updates stay in your activity feed. Open a building for the details.</p></div></section>

    <section id="starting-lives" className="welcome-lives" aria-labelledby="starting-title"><div className="welcome-section-heading"><div><span className="welcome-section-label">Find your starting point</span><h2 id="starting-title">A different life. A fresh perspective.</h2></div><p>Choose a fictional scenario.<br/>You can try another anytime.</p></div><div className="welcome-life-grid">{scenarios.map((scenario, i) => <button type="button" className="welcome-life-card" key={scenario.scenarioId} onClick={() => store.startGame(scenario)}><span className="welcome-life-index">0{i + 1}</span><h3>{scenario.title}</h3><p>{lifeDescriptions[i] ?? scenario.description}</p><span className="welcome-life-start">Play this life</span></button>)}</div></section>

    <section className="welcome-section welcome-outcomes" aria-labelledby="outcomes-title"><div className="welcome-section-heading"><div><span className="welcome-section-label">Beyond a single playthrough</span><h2 id="outcomes-title">One strategy. Many possible stories.</h2></div><p>There is no perfect score.<br/>The goal is to understand the trade-offs.</p></div><div className="welcome-outcome-grid"><article><span className="welcome-outcome-word">Your path</span><h3>See what happened.</h3><p>Your timeline keeps the decisions and events from your actual run, so you can look back at how things changed.</p></article><article><span className="welcome-outcome-word">1,000 futures</span><h3>Explore different luck.</h3><p>The simulation replays your strategy with different market returns and events over the same played time period.</p></article><article><span className="welcome-outcome-word">A wider view</span><h3>Understand the range.</h3><p>Compare typical outcomes and financial pressure. A strong or difficult result is not a verdict on your choices.</p></article></div><p className="welcome-outcomes-note">All returns, event probabilities, and financial assumptions are illustrative. These are learning scenarios, not forecasts.</p></section>

    <section id="your-question" className="welcome-question" aria-labelledby="question-title"><div><span className="welcome-section-label">Start with what matters to you</span><h2 id="question-title">Have a question in mind?</h2><p>Turn a money question into a scenario you can explore. Try something like saving while paying off debt.</p><small>Keep personal details out. When available, AI helps build your scenario. Offline mode uses a local alternative.</small></div><form onSubmit={async e => { e.preventDefault(); setFormError(''); try { const result = await store.generatePersonalized(prompt); store.startGame(result.config) } catch (error) { setFormError(error instanceof Error ? error.message : 'We couldn’t prepare that scenario. Please try again.') } }}><label htmlFor="situation">What would you like to explore?</label><textarea id="situation" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="How could I build savings while paying off debt?" required maxLength={1000}/><div className="welcome-form-bottom"><span>No sensitive information needed.</span><button type="submit" className="welcome-button welcome-button-primary" disabled={store.personalizationLoading}>{store.personalizationLoading ? 'Preparing your scenario…' : 'Explore my question'}</button></div>{(formError || store.personalizationError) && <p role="alert" className="welcome-error">{formError || store.personalizationError}</p>}</form></section>

    <section id="questions" className="welcome-section welcome-faq" aria-labelledby="faq-title"><div><span className="welcome-section-label">Before you start</span><h2 id="faq-title">A few things to know.</h2><p>A game for exploring money, without putting your own money on the line.</p></div><div className="welcome-faq-list">{[
      ['Do I need an account?', 'No. You can start playing right away. The sign-in and create-account buttons are placeholders and do not collect any information.'],
      ['Is any real money involved?', 'No. Every balance, paycheck, investment, and payment belongs to a fictional simulation. No bank connection is needed.'],
      ['Can I play at my own pace?', 'Yes. Time moves forward when you advance a month. Open the buildings, review your choices, and pause whenever you need.'],
      ['What if AI is unavailable?', 'The starting lives work offline. Personal questions and narrative opportunities have clearly labeled local fallbacks.'],
      ['Will this tell me the right financial decision?', 'The game helps you explore trade-offs and uncertainty. It does not provide personal financial advice or guarantee an outcome.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>

    <section className="welcome-final-invite"><span className="welcome-section-label">Your next chapter starts here</span><h2>A little practice.<br/>A new perspective on money.</h2><p>Choose a life and see where your decisions take you.</p><a className="welcome-button welcome-button-primary" href="#starting-lives">Start playing Financial Town</a></section>

    <footer className="welcome-footer"><a className="welcome-footer-name" href="#top">Financial Town</a><p>Fictional educational simulation. Assumptions are illustrative.<br/>For learning, not personal financial advice.</p><a href="#top">Back to top</a></footer>
  </main>
}
