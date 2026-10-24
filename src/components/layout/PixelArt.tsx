import { useEffect, useRef } from 'react'
import { buildingIds, buildings } from '../town/buildings'
import type { BuildingId } from '../../types/domain'

export function PixelPortrait({ variant = 0 }: { variant?: number }) {
  const shirts = ['#7289b0', '#537b56', '#b07947', '#ac6570']
  return <svg viewBox="0 0 48 48" className="pixel-portrait" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#283d39" d="M4 4h40v40H4z"/><path fill="#719478" d="M8 8h32v32H8z"/>
    <path fill="#9cb58b" d="M8 8h32v15H8z"/><path fill="#b6c39b" d="M10 11h4v3h-4zM33 17h5v3h-5z"/>
    <path fill="#493d35" d="M16 13h16v15H16zM13 19h4v10h-4z"/>
    <path fill="#e7b380" d="M18 16h12v14H18zM16 20h2v6h-2zM30 20h2v6h-2z"/>
    <path fill="#5e4435" d="M17 13h14v6H17zM17 19h4v3h-4z"/>
    <path fill="#8a6040" d="M18 14h8v2h-8zM27 16h3v2h-3z"/>
    <path fill="#f4c997" d="M19 19h2v3h-2zM20 25h3v2h-3z"/>
    <path fill="#493d35" d="M21 22h2v2h-2zM27 22h2v2h-2z"/><path fill="#b87556" d="M24 27h4v1h-4z"/>
    <path fill={shirts[variant % 4]} d="M15 31h18v9H15zM12 34h24v6H12z"/>
    <path fill="#344c4c" opacity=".3" d="M31 32h2v8h-2zM12 38h24v2H12z"/>
    <path fill="#eed7a4" d="M21 30h6v4h-6z"/>
    {variant === 0 && <><path fill="#374f70" d="M13 11h21v4H13zM18 8h12v4H18z"/><path fill="#f1c56a" d="M33 12h2v8h-2z"/></>}
    {variant === 1 && <path fill="#e9bd63" d="M22 34h4v4h-4z"/>}
    {variant === 2 && <path fill="#e9d8ac" d="M19 31h4l2 7 2-7h4l-3 9h-6z"/>}
    {variant === 3 && <><path fill="#6a4d34" d="M31 28h8v9h-8z"/><path fill="#e7b380" d="M33 30h5v6h-5z"/><path fill="#d8a34e" d="M30 37h11v3H30z"/></>}
    <path fill="#d5b277" d="M4 4h40v2H4zM4 4h2v40H4z"/><path fill="#705136" d="M42 4h2v40h-2zM4 42h40v2H4z"/>
  </svg>
}

export function PixelIcon({ kind = 'coin' }: { kind?: 'coin' | 'book' | 'leaf' | 'calendar' }) {
  return <svg viewBox="0 0 24 24" className="pixel-icon-art" aria-hidden="true" shapeRendering="crispEdges">
    {kind === 'coin' && <><path fill="#89542d" d="M7 2h10v3h3v14h-3v3H7v-3H4V5h3z"/><path fill="#e7a642" d="M7 4h10v3h2v10h-2v3H7v-3H5V7h2z"/><path fill="#ffe09b" d="M8 5h7v2H8zM7 7h2v9H7z"/><path fill="#a56c32" d="M11 8h4v2h-2v4h2v2h-4z"/></>}
    {kind === 'book' && <><path fill="#604b38" d="M3 3h18v18H3z"/><path fill="#ac7045" d="M4 3h15v17H4z"/><path fill="#ead6a4" d="M7 5h12v13H7z"/><path fill="#9c8054" d="M9 8h8v1H9zM9 11h8v1H9zM9 14h5v1H9z"/></>}
    {kind === 'leaf' && <><path fill="#507148" d="M11 12h3v10h-3zM3 5h8v3h3v7H7v-3H3zM14 4h7v7h-3v4h-5V8h1z"/><path fill="#91b65b" d="M4 6h6v3h3v3H8V9H4zM15 5h5v5h-3v3h-3V9h1z"/></>}
    {kind === 'calendar' && <><path fill="#765438" d="M3 4h18v18H3z"/><path fill="#f1dcab" d="M5 9h14v11H5z"/><path fill="#b65b43" d="M4 5h16v4H4z"/><path fill="#624a38" d="M7 2h2v5H7zM15 2h2v5h-2zM8 12h3v3H8zM14 12h3v3h-3zM8 17h3v2H8z"/></>}
  </svg>
}

export function WorldBackdrop() {
  return <div className="world-backdrop" aria-hidden="true"><svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
    <path fill="#a8cbd0" d="M0 0h1440v900H0z"/>
    <path fill="#c6dfd4" d="M0 402h40v-12h56v-14h48v-18h48v-20h48v-16h56v-18h40v-14h48v14h64v16h56v18h64v16h48v-20h40v-18h48v-16h40v-16h48v-14h56v20h48v16h56v16h48v18h64v18h48v-16h48v-18h56v-18h48v-16h56v16h48v16h48v20h64v18h56v20h72v500H0z"/>
    <path fill="#7a9e78" d="M0 510h64v-16h56v-16h48v-18h48v-18h64v16h56v18h64v-16h40v-20h48v-20h48v-18h64v18h48v16h56v18h56v18h48v-18h48v-20h56v-18h64v18h56v16h56v20h56v18h48v-16h56v-18h48v-16h64v16h48v18h48v18h56v400H0z"/>
    <path fill="#60856a" d="M0 610h180v-40h220v25h315v20h200v-35h230v30h295v290H0z"/>
    {[85,270,1200,1390].map((x,i)=><g key={x} transform={`translate(${x} ${690+i%2*45})`}>
      <path fill="#547455" d="M-32 54h68v8h-68z"/>
      <path fill="#70563f" d="M-8 0H8v65H-8z"/><path fill="#ad8b5b" d="M-5 0h4v60h-4z"/>
      <path fill="#3d624b" d="M-16-80h32v8h12v12h12v16h8v28h-8V0H24v8H-24V0h-16v-16h-8v-28h8v-16h12v-12h12z"/>
      <path fill="#6e9465" d="M-12-76h24v8h12v12h12v16H24v16H4v8H-24v-8h-16v-20h12v-16h16z"/>
      <path fill="#a4bd80" d="M-8-72H8v6H-8zM-24-55h12v6h-12zM10-42h12v5H10zM-29-26h10v5h-10z"/>
      <path fill="#5a8056" d="M24-25h12v6H24zM-8-12H5v5H-8z"/>
    </g>)}
    <path fill="#e4ebd9" d="M100 150h40v-16h80v16h40v16H100zM1120 90h32V74h64v16h48v16h-144z"/>
  </svg></div>
}

/** Original low-resolution artwork. Each logical pixel occupies about four screen pixels. */
export function ResponsiveTownArtwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const scene = canvas?.parentElement
    if (!canvas || !scene) return
    let frame = 0
    function paint() {
      if (!canvas || !scene) return
      const bounds = scene.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const width = Math.max(80, Math.round(bounds.width / 4))
      const height = Math.max(60, Math.round(bounds.height / 4))
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      const rect = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color
        ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
      }
      const px = (x: number) => Math.round(width * x)
      const py = (y: number) => Math.round(height * y)
      rect(0, 0, width, height, '#a8bf85')
      // Broad, quiet patches instead of individual grass blades and scattered props.
      for (let i = 0; i < 28; i++) {
        const x = (i * 67 + 17) % width
        const y = (i * 41 + 11) % height
        rect(x, y, 3 + i % 3, 2, i % 2 ? '#a0b87b' : '#b3c890')
      }
      const road = Math.max(7, Math.round(Math.min(width, height) * .075))
      const lane = py(.47)
      const vertical = (x: number, from: number, to: number) => {
        rect(x - road / 2, from, road, to - from, '#bca16c')
        rect(x - road / 2 + 1, from, road - 2, to - from, '#e3cc94')
      }
      rect(0, lane - road / 2, width, road, '#bca16c')
      rect(0, lane - road / 2 + 1, width, road - 2, '#e3cc94')
      vertical(px(.505), py(.15), py(.91))
      for (const id of buildingIds) {
        const item = buildings[id]
        if (item.y < 47) vertical(px(item.x / 100), py(item.y / 100), lane)
        else vertical(px(item.x / 100), lane, py(item.y / 100 + .13))
      }
      // A single small pond, with stepped shore and a few readable water highlights.
      rect(0, py(.82), px(.12), height, '#819e78')
      rect(0, py(.85), px(.16), height, '#819e78')
      rect(0, py(.84), px(.105), height, '#679dab')
      rect(0, py(.87), px(.145), height, '#679dab')
      rect(0, py(.85), px(.09), height, '#85b9be')
      rect(0, py(.89), px(.13), height, '#85b9be')
      rect(px(.025), py(.9), 5, 1, '#c4dbce')
      rect(px(.08), py(.96), 6, 1, '#c4dbce')
      const tree = (x: number, y: number) => {
        rect(x - 6, y + 7, 15, 3, '#8ca775')
        rect(x - 1, y + 1, 3, 8, '#8b6745')
        rect(x - 6, y - 9, 12, 11, '#4b7355')
        rect(x - 9, y - 6, 18, 7, '#4b7355')
        rect(x - 4, y - 12, 9, 4, '#4b7355')
        rect(x - 5, y - 9, 9, 8, '#749956')
        rect(x - 7, y - 5, 5, 4, '#88aa65')
        rect(x - 3, y - 10, 5, 3, '#a1bc79')
        rect(x + 3, y - 4, 4, 4, '#5d854e')
      }
      tree(px(.06), py(.15))
      tree(px(.94), py(.16))
      tree(px(.07), py(.7))
      tree(px(.93), py(.73))
      tree(px(.86), py(.93))
      // A modest fountain and two flower beds are the only central decoration.
      const fx = px(.505), fy = lane
      rect(fx - 7, fy - 3, 15, 9, '#9c9d7d')
      rect(fx - 6, fy - 4, 12, 8, '#d6cfaa')
      rect(fx - 4, fy - 3, 8, 5, '#71a9b6')
      rect(fx - 1, fy - 8, 3, 8, '#b2d3ca')
      rect(fx - 2, fy - 9, 5, 2, '#e2e7cf')
      for (const x of [.38, .72]) {
        const bx = px(x), by = py(.41)
        rect(bx - 4, by, 9, 3, '#7d945e')
        rect(bx - 3, by - 2, 2, 2, '#eacb83')
        rect(bx + 2, by - 1, 2, 2, '#d69583')
      }
      // Paint every sprite into the exact bounds of its accessible HTML hotspot.
      const canvasBounds = canvas.getBoundingClientRect()
      for (const id of buildingIds) {
        const target = scene.querySelector<HTMLElement>(`.hotspot-${id}`)
        if (!target) continue
        const box = target.getBoundingClientRect()
        const sx = (box.left - canvasBounds.left) / canvasBounds.width * width
        const sy = (box.top - canvasBounds.top) / canvasBounds.height * height
        const sw = box.width / canvasBounds.width * width
        const sh = box.height / canvasBounds.height * height
        const r = (x: number, y: number, w: number, h: number, color: string) => rect(sx + x / 48 * sw, sy + y / 48 * sh, w / 48 * sw, h / 48 * sh, color)
        const colors: Record<BuildingId, [string, string, string]> = {
          bank: ['#b4c4ba', '#637f8b', '#8ca3aa'],
          office: ['#d1b88a', '#587f79', '#82a59a'],
          hospital: ['#e5d5ac', '#b27668', '#cd9580'],
          home: ['#d5ae76', '#ac6e50', '#cb9064'],
          market: ['#c8b086', '#64836c', '#91a389'],
        }
        const [wall, roof, roofLight] = colors[id]
        r(7, 41, 39, 5, '#859c72')
        r(34, 21, 10, 21, '#927b59')
        r(5, 21, 31, 21, '#6e5742')
        r(7, 22, 27, 18, wall)
        r(7, 23, 3, 16, '#e8d3a4')
        r(7, 38, 27, 3, '#a78e65')
        r(3, 19, 39, 5, '#536351')
        r(6, 14, 34, 6, roof)
        r(10, 10, 26, 5, roof)
        r(14, 6, 18, 5, roof)
        r(14, 6, 18, 2, roofLight)
        r(10, 12, 24, 2, roofLight)
        r(6, 18, 31, 2, roofLight)
        r(37, 17, 5, 6, '#50675c')
        r(11, 27, 8, 8, '#536a68')
        r(12, 28, 5, 5, '#a7c7b8')
        r(27, 27, 5, 8, '#536a68')
        r(28, 28, 3, 5, '#a7c7b8')
        r(20, 28, 6, 13, '#72563d')
        r(21, 29, 4, 11, '#bc8c56')
        r(24, 34, 1, 2, '#f2d391')
        r(18, 41, 11, 2, '#dac69a')
        r(16, 44, 15, 2, '#b5a783')
        r(38, 28, 4, 7, '#6c7765')
        r(38, 29, 2, 4, '#9bb5a4')
        if (id === 'bank') {
          r(18, 13, 10, 8, '#8a6a3a'); r(20, 13, 6, 7, '#e1b85b'); r(21, 14, 3, 2, '#f7db8e')
        } else if (id === 'office') {
          r(17, 4, 12, 12, '#6e6349'); r(19, 5, 8, 9, '#ead8ae'); r(22, 7, 1, 5, '#745c43'); r(23, 10, 3, 1, '#745c43')
        } else if (id === 'hospital') {
          r(17, 12, 13, 11, '#eee1bc'); r(22, 13, 3, 9, '#b96a5a'); r(19, 16, 9, 3, '#b96a5a')
        } else if (id === 'home') {
          r(31, 2, 5, 10, '#8c7860'); r(31, 2, 6, 2, '#c8baa0'); r(10, 35, 8, 2, '#7b945e'); r(12, 34, 2, 2, '#d39b82')
        } else {
          r(5, 24, 30, 6, '#e2d6a8'); r(5, 24, 5, 6, '#668466'); r(15, 24, 5, 6, '#668466'); r(25, 24, 5, 6, '#668466')
          r(7, 36, 9, 6, '#9c794b'); r(8, 35, 3, 3, '#b76e50'); r(12, 35, 3, 3, '#d6b558')
        }
      }
    }
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint) }
    const observer = new ResizeObserver(redraw)
    observer.observe(scene)
    redraw()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [])
  return <canvas ref={canvasRef} className="responsive-town-art" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }}/>
}

