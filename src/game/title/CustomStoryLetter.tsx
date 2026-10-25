import { useRef, useState, useEffect, type FormEvent } from 'react'
import { Board, Button, Field, Select, Tag } from '@/ui'
import { useGameStore, type PersonalizationResult } from '@/stores/useGameStore'
import type { PersonalizedInput } from '@/types/domain'
import { scenarioCards } from '@/data/scenarios'

const examples = ["I'm 24, earn $48k, rent is $1,400 and I have $9k of card debt.", 'How could I build an emergency fund while raising two children?', 'I want to explore investing while paying down a student loan.']
type Numbers = Omit<PersonalizedInput, 'freeText'>
type NumberKey = Exclude<keyof Numbers, 'car'>
const carOptions = [{ value: '', label: 'Not specified (inferred from your letter)' }, { value: 'no', label: 'No car' }, { value: 'yes', label: 'Yes, I own a car' }]
const fields: { key: NumberKey; label: string; max: number; step: string }[] = [
  { key: 'age', label: 'Age', max: 110, step: '1' },
  { key: 'grossAnnualIncome', label: 'Yearly income (USD)', max: 1000000, step: '1' },
  { key: 'monthlyRent', label: 'Monthly rent (USD)', max: 20000, step: '1' },
  { key: 'savings', label: 'Savings (USD)', max: 10000000, step: '1' },
  { key: 'debtBalance', label: 'Debt balance (USD)', max: 5000000, step: '1' },
  { key: 'debtApr', label: 'Debt APR (decimal, e.g. 0.249)', max: 0.6, step: '0.001' },
  { key: 'dependents', label: 'Dependents', max: 8, step: '1' },
]

export function CustomStoryLetter() {
  const [prompt, setPrompt] = useState('')
  const [numbers, setNumbers] = useState<Numbers>({})
  const [result, setResult] = useState<PersonalizationResult | null>(null)
  const [error, setError] = useState('')
  // The numbers panel stays open (and keeps the typed values in view) when the player comes back to edit the letter.
  const [numbersOpen, setNumbersOpen] = useState(false)
  const active = useRef(true)
  const version = useRef(0)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const formHeading = useRef<HTMLHeadingElement>(null)
  const generate = useGameStore(state => state.generatePersonalized)
  const start = useGameStore(state => state.startGame)
  const loading = useGameStore(state => state.personalizationLoading)
  const storeError = useGameStore(state => state.personalizationError)
  useEffect(() => { active.current = true; return () => { active.current = false; version.current++ } }, [])
  useEffect(() => { (result ? resultHeading : formHeading).current?.focus() }, [result])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const request = ++version.current
    setError('')
    try {
      const prepared = await generate(prompt, numbers)
      if (active.current && request === version.current) setResult(prepared)
    } catch (reason) {
      if (active.current && request === version.current) setError(reason instanceof Error ? reason.message : 'Please try again.')
    }
  }
  return <Board className="fv-letter" padding="lg">
    {result ? <div className="fv-letter-result"><span className="fv-letter-kicker">Your invitation to the valley</span><h2 ref={resultHeading} tabIndex={-1}>{result.config.title}</h2>
      <p>Based on {scenarioCards.find(card => card.id === result.config.archetype)?.title ?? 'a fictional starting life'}.</p>
      {result.fallback && <p><Tag>Made offline from a template</Tag></p>}
      {result.warnings.length > 0 && <ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
      <div className="fv-actions"><Button variant="primary" onClick={() => start(result.config)}>Start this story</Button><Button onClick={() => setResult(null)}>Edit</Button></div>
    </div> : <form onSubmit={submit} aria-busy={loading}>
      <h2 ref={formHeading} tabIndex={-1}>Dear Valley, here is my situation…</h2><p>A fictional story shaped around what you want to explore.</p>
      <Field multiline label="What would you like to explore?" id="fv-story-prompt" required maxLength={2000} rows={4} value={prompt} onChange={event => setPrompt(event.target.value)} hint="Keep identifying details out of your letter." aria-describedby="fv-prompt-count"/>
      <div className="fv-letter-meta"><small id="fv-prompt-count">{prompt.length} / 2,000</small></div>
      <div className="fv-examples" role="group" aria-label="Example situations">{examples.map((example, i) => <Button size="sm" key={example} onClick={() => { setPrompt(example); document.getElementById('fv-story-prompt')?.focus() }}><b>Example {i + 1}</b>{example}</Button>)}</div>
      <details className="fv-letter-numbers" open={numbersOpen} onToggle={event => setNumbersOpen(event.currentTarget.open)}><summary>Add numbers <small>(optional)</small></summary><div className="fv-number-grid">{fields.map(field =>
        <Field key={field.key} label={field.label} type="number" inputMode="decimal" min={field.key === 'age' ? 13 : 0} max={field.max} step={field.step} value={numbers[field.key] ?? ''} onChange={event => setNumbers(previous => { const next = { ...previous }; if (event.target.value === '') delete next[field.key]; else next[field.key] = event.target.valueAsNumber; return next })}/>)}
        <Select label="Car" options={carOptions} value={numbers.car === undefined ? '' : numbers.car.owned ? 'yes' : 'no'} onChange={value => setNumbers(previous => { const next = { ...previous }; if (value === '') delete next.car; else next.car = value === 'yes' ? { owned: true, ...(previous.car?.monthlyCost !== undefined ? { monthlyCost: previous.car.monthlyCost } : {}) } : { owned: false }; return next })}/>
        {numbers.car?.owned && <Field label="Monthly car cost (USD, fuel + upkeep)" type="number" inputMode="decimal" min={0} max={5000} step="1" value={numbers.car.monthlyCost ?? ''} onChange={event => setNumbers(previous => { const car = { owned: true as const, monthlyCost: event.target.valueAsNumber }; if (event.target.value === '' || !Number.isFinite(car.monthlyCost)) return { ...previous, car: { owned: true } }; return { ...previous, car } })}/>}
      </div></details>
      <div className="fv-actions"><Button type="submit" variant="primary" disabled={loading || !prompt.trim()}>Write my story</Button>
      {loading && <span role="status"><span className="fv-quill" aria-hidden="true"/>The valley is preparing your story…</span>}</div>
      {(error || storeError) && <p role="alert">{error || storeError}</p>}
    </form>}
  </Board>
}
