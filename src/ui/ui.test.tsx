// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Modal, Tabs, Toggle, Money, NumberField, Field, Button, IconButton, Icon, Select, Slider, Tooltip, Dropdown, setUiReducedMotion, useReducedMotion } from './index'

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
describe('UI kit components', () => {
  it('renders button variants, sizes and icons, and names icon buttons', () => {
    render(<><Button variant="primary" size="lg" icon="coin" iconRight="arrow-right">Next month</Button><IconButton icon="gear" label="Options"/></>)
    const button = screen.getByRole('button', {name:'Next month'}); expect(button.className).toContain('fv-button--primary'); expect(button.className).toContain('fv-button--lg')
    expect(button.querySelectorAll('img.fv-icon')).toHaveLength(2); expect(button.getAttribute('type')).toBe('button')
    const icon = screen.getByRole('button', {name:'Options'}); expect(icon.getAttribute('title')).toBe('Options'); expect(icon.className).toContain('fv-icon-button')
  })
  it('hides decorative icons and labels named ones', () => {
    const {container} = render(<><Icon name="coin"/><Icon name="leaf" size={16} label="Savings"/></>)
    const [plain, named] = Array.from(container.querySelectorAll('img')); expect(plain!.getAttribute('aria-hidden')).toBe('true'); expect(plain!.getAttribute('alt')).toBe('')
    expect(named!.getAttribute('aria-hidden')).toBeNull(); expect(named!.getAttribute('alt')).toBe('Savings'); expect(named!.getAttribute('src')).toContain('leaf-16.png')
  })
  it('emits select values and slider value text', () => {
    const select = vi.fn(), slide = vi.fn()
    render(<><Select label="Material" value="wood" onChange={select} options={[{value:'wood',label:'Wood'},{value:'paper',label:'Paper'}]}/><Slider label="Contribution" value={200} onChange={slide} min={0} max={1000} step={10} format={value => `$${value}`} error="Too low"/></>)
    fireEvent.change(screen.getByRole('combobox', {name:'Material'}), {target:{value:'paper'}}); expect(select).toHaveBeenCalledWith('paper')
    const slider = screen.getByRole('slider', {name:/Contribution/}); expect(slider.getAttribute('aria-valuetext')).toBe('$200')
    expect(slider.getAttribute('aria-invalid')).toBe('true'); expect(screen.getByRole('alert').textContent).toBe('Too low')
    fireEvent.change(slider, {target:{value:'300'}}); expect(slide).toHaveBeenCalledWith(300)
  })
  it('opens a themed listbox dropdown with keyboard support and groups', () => {
    const change = vi.fn()
    render(<Dropdown label="Decision" value="b" onChange={change} groups={[{label:'Yours',options:[{value:'a',label:'Alpha'},{value:'b',label:'Bravo'}]},{label:'From the start',options:[{value:'c',label:'Charlie'}]}]}/>)
    const button = screen.getByRole('combobox', {name:'Decision'}); expect(button.textContent).toBe('Bravo'); expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.keyDown(button, {key:'ArrowDown'})
    const list = screen.getByRole('listbox', {name:'Decision'}); expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Alpha','Bravo','Charlie']); expect(screen.getAllByRole('group')).toHaveLength(2)
    expect(screen.getByRole('option', {name:'Bravo'}).getAttribute('aria-selected')).toBe('true'); expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', {name:'Bravo'}).id)
    fireEvent.keyDown(list, {key:'ArrowDown'}); expect(list.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', {name:'Charlie'}).id)
    fireEvent.keyDown(list, {key:'Home'}); fireEvent.keyDown(list, {key:'Enter'}); expect(change).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('listbox')).toBeNull(); expect(document.activeElement).toBe(button)
    fireEvent.click(button); fireEvent.keyDown(screen.getByRole('listbox'), {key:'Escape'}); expect(screen.queryByRole('listbox')).toBeNull(); expect(change).toHaveBeenCalledTimes(1)
    fireEvent.click(button); fireEvent.click(screen.getByRole('option', {name:'Charlie'})); expect(change).toHaveBeenLastCalledWith('c')
  })
  it('describes its child with a tooltip', () => {
    render(<Tooltip content="Keyboard: N"><Button>Next</Button></Tooltip>)
    const tip = screen.getByRole('tooltip'); expect(tip.textContent).toBe('Keyboard: N'); expect(screen.getByRole('button').closest('[aria-describedby]')?.getAttribute('aria-describedby')).toBe(tip.id)
  })
})
