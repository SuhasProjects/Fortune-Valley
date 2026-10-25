import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/ui'
import { useGameStore } from '@/stores/useGameStore'
import { TitleStage, TitleOptions, readReduceMotion, clickSound } from './contracts'
import { TitleScene } from './TitleScene'
import { StoryPicker } from './StoryPicker'
import { CustomStoryLetter } from './CustomStoryLetter'
import { GuideWindow } from './GuideWindow'
import { isDemoMode } from '@/demo/demoMode'

export function TitleScreen() {
  const [screen, setScreen] = useState<'menu' | 'picker' | 'letter'>('menu')
  const [window, setWindow] = useState<'guide' | 'options' | null>(null)
  const [reduceMotion, setReduceMotion] = useState(readReduceMotion)
  const savedGame = useGameStore(state => state.savedGame)
  const loadSavedGame = useGameStore(state => state.loadSavedGame)
  const refresh = useGameStore(state => state.refreshSavedGame)
  const menu = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<'New Story' | 'Custom Story'>('New Story')
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (screen !== 'menu') content.current?.querySelector<HTMLElement>('h2')?.focus()
  }, [screen])
  function back() {
    setScreen('menu')
    requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>(`[data-menu="${returnFocus.current}"]`)?.focus())
  }
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length
    event.preventDefault(); buttons[next]?.focus()
  }
  return <TitleStage label="Fortune Valley" world={<TitleScene/>}>
    <div className={`fv-title ${screen !== 'menu' ? 'fv-title--subscreen' : ''}`} data-reduce-motion={reduceMotion} onKeyDown={event => {
      if (event.key === 'Escape' && screen !== 'menu' && !window) { event.preventDefault(); back() }
    }}>
      <header className="fv-sign-wrap">
        <div className="fv-ropes" aria-hidden="true"/>
        <div className={`fv-sign ${screen !== 'menu' ? 'fv-sign--small' : ''}`}>
          <div className="fv-vine fv-vine--top" aria-hidden="true"/><div className="fv-vine fv-vine--left" aria-hidden="true"/><div className="fv-vine fv-vine--right" aria-hidden="true"/>
          <h1>Fortune Valley</h1>
        </div>
      </header>
      {screen === 'menu' ? <div className="fv-title-menu" role="group" aria-label="Main menu" ref={menu} onKeyDown={move} onClick={clickSound}>
        <Button size="lg" data-menu="New Story" onClick={() => { returnFocus.current = 'New Story'; setScreen('picker') }}>New Story</Button>
        <Button size="lg" data-menu="Custom Story" onClick={() => { returnFocus.current = 'Custom Story'; setScreen('letter') }}>Custom Story</Button>
        {!isDemoMode() && <Button size="lg" disabled={!savedGame} title={savedGame ? 'Continue your saved story' : 'No saved story yet'} onClick={() => loadSavedGame()}>Continue{savedGame && <small>Month {savedGame.monthIndex} · {savedGame.title}</small>}</Button>}
      </div> : <div className="fv-title-content" ref={content}>
        <Button className="fv-back" onClick={back}>Back</Button>
        {screen === 'picker' ? <StoryPicker/> : <CustomStoryLetter/>}
      </div>}
      <footer className="fv-title-corners">
        <Button icon="gear" aria-label="Options" onClick={() => setWindow('options')}>Options</Button>
        <Button icon="book" aria-label="Guide" onClick={() => setWindow('guide')}>Guide</Button>
      </footer>
      {window === 'guide' && <GuideWindow onClose={() => setWindow(null)}/>}
      {window === 'options' && <TitleOptions onClose={() => setWindow(null)} onMotionChange={() => setReduceMotion(readReduceMotion())}/>}
    </div>
  </TitleStage>
}
