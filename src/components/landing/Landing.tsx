import { useState } from 'react'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'

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
        <span className="welcome-logo" aria-hidden="true">ft.</span>
        <span>Financial Town<small>A space to learn about money</small></span>
      </a>
      <nav className="welcome-nav" aria-label="Main navigation">
        <button type="button" className="welcome-nav-link" aria-expanded={howOpen} aria-controls="how-it-works" onClick={() => setHowOpen(open => !open)}>How it works <span className={howOpen ? 'welcome-chevron is-open' : 'welcome-chevron'} aria-hidden="true">⌄</span></button>
        <a className="welcome-nav-link" href="#starting-lives">Starting lives</a>
        <a className="welcome-nav-link" href="#your-question">Your question</a>
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
      <div className="welcome-hero-copy"><span className="welcome-section-label"><span className="welcome-dot"/>Learn by making choices</span><h1 id="welcome-title">Small choices.<br/>A clearer financial future.</h1><p>Get comfortable with money, one decision at a time. Explore everyday trade-offs in a simple, interactive town.</p><div className="welcome-hero-actions"><a className="welcome-button welcome-button-primary" href="#starting-lives">Start exploring <span aria-hidden="true">↗</span></a><button className="welcome-button welcome-button-text" type="button" onClick={() => { setHowOpen(true); document.getElementById('how-it-works')?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>See how it works <span aria-hidden="true">↓</span></button></div><span className="welcome-hero-note">Free to explore. No account required.</span></div>
      <div className="welcome-graphic" aria-label="Income connects to everyday costs, a savings cushion, and future goals">
        <div className="welcome-graphic-heading"><span className="welcome-section-label">The everyday picture</span><span className="welcome-graphic-dot"/></div>
        <div className="welcome-income"><span className="welcome-line-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="5" y="8" width="22" height="18" rx="2"/><path d="M11 8V5h10v3M5 15h22M13 15v4h6v-4"/></svg></span><span>Your income<small>A starting point for your choices</small></span></div>
        <div className="welcome-connectors" aria-hidden="true"><i/><i/><i/></div>
        <div className="welcome-goals">{['Everyday costs', 'A savings cushion', 'Future goals'].map((label, i) => <div key={label}><span className="welcome-line-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none">{i === 0 ? <><path d="m5 14 11-9 11 9M8 12v15h16V12M13 27v-9h6v9"/></> : i === 1 ? <><path d="M16 4 26 8v8c0 6-10 12-10 12S6 22 6 16V8L16 4Z"/><path d="m11 15 4 4 7-8"/></> : <><path d="M7 27V6M8 6h17l-4 6 4 6H8"/></>}</svg></span><span>{label}</span></div>)}</div>
        <div className="welcome-graphic-footer"><span aria-hidden="true">↳</span><p>Explore how your choices work together.</p></div>
      </div>
    </section>

    <div className="welcome-benefits"><span><i aria-hidden="true">✓</i> Everyday financial decisions</span><span><i aria-hidden="true">✓</i> Learn at your own pace</span><span><i aria-hidden="true">✓</i> See a range of outcomes</span></div>

    <section id="starting-lives" className="welcome-lives" aria-labelledby="starting-title"><div className="welcome-section-heading"><div><span className="welcome-section-label">Find your starting point</span><h2 id="starting-title">A different life. A fresh perspective.</h2></div><p>Choose a fictional scenario.<br/>You can try another anytime.</p></div><div className="welcome-life-grid">{scenarios.map((scenario, i) => <button type="button" className="welcome-life-card" key={scenario.scenarioId} onClick={() => store.startGame(scenario)}><span className="welcome-life-index">0{i + 1}</span><h3>{scenario.title}</h3><p>{lifeDescriptions[i] ?? scenario.description}</p><span className="welcome-life-start">Explore this life <span aria-hidden="true">↗</span></span></button>)}</div></section>

    <section id="your-question" className="welcome-question" aria-labelledby="question-title"><div><span className="welcome-section-label">Start with what matters to you</span><h2 id="question-title">Have a question in mind?</h2><p>Turn a money question into a scenario you can explore. Try something like saving while paying off debt.</p><small>Keep personal details out. When available, AI helps build your scenario. Offline mode uses a local alternative.</small></div><form onSubmit={async e => { e.preventDefault(); setFormError(''); try { const result = await store.generatePersonalized(prompt); store.startGame(result.config) } catch (error) { setFormError(error instanceof Error ? error.message : 'We couldn’t prepare that scenario. Please try again.') } }}><label htmlFor="situation">What would you like to explore?</label><textarea id="situation" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="How could I build savings while paying off debt?" required maxLength={1000}/><div className="welcome-form-bottom"><span>No sensitive information needed.</span><button type="submit" className="welcome-button welcome-button-primary" disabled={store.personalizationLoading}>{store.personalizationLoading ? 'Preparing your scenario…' : 'Explore my question'}<span aria-hidden="true">↗</span></button></div>{(formError || store.personalizationError) && <p role="alert" className="welcome-error">{formError || store.personalizationError}</p>}</form></section>

    <footer className="welcome-footer"><a className="welcome-footer-name" href="#top">Financial Town</a><p>Fictional educational simulation. Assumptions are illustrative.<br/>For learning, not personal financial advice.</p><a href="#top">Back to top ↑</a></footer>
  </main>
}
