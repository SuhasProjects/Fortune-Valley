// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Modal, Tabs, Toggle, Money, NumberField, Field, Button, setUiReducedMotion, useReducedMotion } from './index'

afterEach(() => { cleanup(); vi.restoreAllMocks(); setUiReducedMotion(false) })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
describe('UI accessibility contracts', () => {
  it('names a modal, contains Tab, closes on Escape and restores focus', () => {
    const close = vi.fn()
    const opener = document.createElement('button'); document.body.append(opener); opener.focus()
    const { unmount } = render(<Modal title="Pine Bank" onClose={close}><Button>Last action</Button></Modal>)
    const dialog = screen.getByRole('dialog', { name: 'Pine Bank' }), first = screen.getByRole('button', { name: 'Close panel' }), last = screen.getByRole('button', { name: 'Last action' })
    vi.spyOn(first, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    vi.spyOn(last, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    first.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last)
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(first)
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true })); expect(close).toHaveBeenCalledOnce()
    fireEvent.click(first); expect(close).toHaveBeenCalledTimes(2)
    expect(document.body.style.overflow).toBe('hidden')
    unmount(); expect(document.activeElement).toBe(opener); expect(document.body.style.overflow).toBe(''); opener.remove()
  })
  it('closes on backdrop clicks, but keeps clicks inside the window', () => {
    const close = vi.fn(); render(<Modal title="Ledger" onClose={close}><p>Inside</p></Modal>)
    const dialog = screen.getByRole('dialog')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({left:10,top:10,right:100,bottom:100} as DOMRect)
    fireEvent.click(dialog, {clientX:20,clientY:20}); fireEvent.click(screen.getByText('Inside')); expect(close).not.toHaveBeenCalled()
    fireEvent.click(dialog, {clientX:2,clientY:2}); expect(close).toHaveBeenCalledOnce()
  })
  it('navigates tabs with arrows, Home and End', () => {
    function Example() { const [value, setValue] = useState('a'); return <Tabs tabs={[{id:'a',label:'Account'},{id:'b',label:'Savings'}]} value={value} onChange={setValue}>{value}</Tabs> }
    render(<Example/>); const first = screen.getByRole('tab', {name:'Account'}), last = screen.getByRole('tab', {name:'Savings'})
    first.focus(); fireEvent.keyDown(first, {key:'ArrowLeft'}); expect(last.getAttribute('aria-selected')).toBe('true'); expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, {key:'Home'}); expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, {key:'End'}); expect(document.activeElement).toBe(last)
  })
  it('announces toggle state and emits the next value', () => {
    const change = vi.fn(); render(<Toggle label="Sound" checked onChange={change}/>); const toggle = screen.getByRole('switch', {name:'Sound'})
    expect(toggle.getAttribute('aria-checked')).toBe('true'); fireEvent.click(toggle); expect(change).toHaveBeenCalledWith(false)
  })
  it('formats money with sign colours and neutral override', () => {
    const {container} = render(<><Money value={42} signed/><Money value={-85}/><Money value={-1} tone="neutral"/></>)
    expect(container.querySelector('.fv-money--positive')?.textContent).toBe('+$42'); expect(container.querySelector('.fv-money--negative')?.textContent).toBe('-$85'); expect(container.querySelector('.fv-money--neutral')?.textContent).toBe('-$1')
  })
  it('preserves visible labels and forwards input attributes', () => {
    const change = vi.fn(); render(<NumberField label="Monthly savings contribution (USD)" aria-label="Savings amount" value={20} onChange={change} min={0} max={100} step={5} prefix="$"/>)
    const input = screen.getByRole('spinbutton', {name:'Savings amount'}); expect(screen.getByText('Monthly savings contribution (USD)')).toBeTruthy(); expect(input.getAttribute('inputmode')).toBe('decimal')
    fireEvent.change(input, {target:{value:'35'}}); expect(change).toHaveBeenCalledWith(35)
  })
  it('links hints and errors to fields', () => {
    render(<Field label="Name" hint="A short name" error="Name required" multiline/>); const field = screen.getByLabelText('Name')
    const ids = field.getAttribute('aria-describedby')!.split(' '); expect(ids.map(id => document.getElementById(id)?.textContent)).toEqual(['A short name','Name required']); expect(field.getAttribute('aria-invalid')).toBe('true')
  })
  it('responds to the host reduced-motion setting', () => {
    setUiReducedMotion(true)
    function Example() { return <span>{String(useReducedMotion())}</span> }
    render(<Example/>); expect(screen.getByText('true')).toBeTruthy()
  })
})
