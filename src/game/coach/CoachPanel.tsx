import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useGameStore } from '../../stores/useGameStore'
import { Board, Button, Field, Modal, Tag } from '../../ui'
import { Sprite } from '../art/Sprite'
import { sfx } from '../audio/sfx'
import './coach.css'

export const COACH_CHIPS = ['What happens if I save more?', 'Pay the card or save?', 'What does this insurance do?'] as const
export const COACH_QUESTION_MAX = 300

/**
 * The Coach: a speech-bubble button in the bottom-right corner of the town and the parchment chat it opens.
 * History lives in the store for the session only. The window is a kit Modal (Escape closes, focus returns to the
 * bubble, Tab is contained) restyled by coach.css to sit over the corner instead of the centre.
 */
export function CoachPanel() {
  const open = useGameStore(state => state.coachOpen)
  const setOpen = useGameStore(state => state.setCoachOpen)
  return <div className="fv-coach">
    <Button className="fv-icon-button fv-coach__button" aria-label="Ask the Coach" title="Ask the Coach" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span className="fv-glyph fv-glyph--bubble" aria-hidden="true"/>
    </Button>
    {open && <CoachWindow onClose={() => setOpen(false)}/>}
  </div>
}

function CoachWindow({ onClose }: { onClose: () => void }) {
  const history = useGameStore(state => state.coachHistory)
  const loading = useGameStore(state => state.coachLoading)
  const ask = useGameStore(state => state.askCoach)
  const [draft, setDraft] = useState('')
  const inputId = 'fv-coach-input'
  const focusInput = () => document.getElementById(inputId)?.focus()
  const log = useRef<HTMLOListElement>(null)
  useEffect(() => { sfx('open'); const t = window.setTimeout(focusInput, 0); return () => { window.clearTimeout(t); sfx('close') } }, [])
  useEffect(() => { log.current?.lastElementChild?.scrollIntoView?.({ block: 'end' }) }, [history.length, loading])

  const send = (question: string) => {
    const q = question.trim()
    if (!q || loading) return
    setDraft('')
    void ask(q)
    focusInput()
  }
  const submit = (event: FormEvent) => { event.preventDefault(); send(draft) }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(draft) } }
  const offline = history.some(turn => turn.role === 'coach' && turn.source === 'fallback')

  return <Modal title="Coach" width="sm" onClose={onClose} headerExtra={offline ? <Tag>Offline</Tag> : undefined}>
    <div className="fv-coach__chat">
      <ol className="fv-coach__log" ref={log} aria-label="Conversation with the Coach" aria-live="polite">
        {history.length === 0 && <li className="fv-coach__turn fv-coach__turn--coach">
          <Portrait/>
          <Board as="p" padding="sm" className="fv-coach__bubble">Hi! Ask me anything about your money in town. I answer with your own numbers, in plain words.</Board>
        </li>}
        {history.map((turn, index) => <li key={index} className={`fv-coach__turn fv-coach__turn--${turn.role}`}>
          {turn.role === 'coach' && <Portrait/>}
          <Board as="p" padding="sm" className="fv-coach__bubble">{turn.text}</Board>
        </li>)}
        {loading && <li className="fv-coach__turn fv-coach__turn--coach" role="status"><Portrait/><Board as="p" padding="sm" className="fv-coach__bubble fv-coach__bubble--thinking">Thinking…</Board></li>}
      </ol>
      {history.length === 0 && <div className="fv-coach__chips" aria-label="Suggested questions">
        {COACH_CHIPS.map(chip => <Button key={chip} size="sm" variant="ghost" onClick={() => send(chip)} disabled={loading}>{chip}</Button>)}
      </div>}
      <form className="fv-coach__form" onSubmit={submit}>
        <Field id={inputId} label="Your question" placeholder="Ask the Coach…" maxLength={COACH_QUESTION_MAX} value={draft} onChange={event => setDraft(event.currentTarget.value)} onKeyDown={onKey} autoComplete="off" disabled={loading}/>
        <Button type="submit" variant="primary" size="sm" disabled={loading || !draft.trim()}>Ask</Button>
      </form>
    </div>
  </Modal>
}

function Portrait() {
  return <Sprite name="windows/keepers/bank" className="fv-coach__portrait" label="The Coach"/>
}
