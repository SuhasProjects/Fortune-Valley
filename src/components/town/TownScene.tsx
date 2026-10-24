import type { BuildingTarget } from '../../types/domain'
import { buildingIds, buildings } from './buildings'

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path fill="#514b36" d="M-3 0h6v20h-6z"/><path fill="#285d43" d="M-12-20h24v8h8V5h-8v6h-24V5h-8v-17h8z"/><path fill="#468257" d="M-9-24h18v7h9v12H9v7H-9v-7h-9v-12h9z"/><path fill="#70a45e" d="M-7-22H5v5H-7zM-15-13h10v5h-10z"/></g>
}
export function BuildingSprite({ building }: { building: BuildingTarget }) {
  return <svg viewBox="0 0 120 100" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#244433" opacity=".3" d="M8 88h108v9H8z"/><path fill="#514538" d="M15 38h90v50H15z"/><path fill={buildings[building].color} d="M19 38h82v46H19z"/>
    <path fill={building === 'home' ? '#a65345' : building === 'market' ? '#568368' : '#526c77'} d="M7 37v-8h10v-9h13v-9h60v9h13v9h10v8z"/>
    <path fill={building === 'home' ? '#d07c56' : '#79929a'} d="M22 27h76v5H22zM33 17h54v5H33z"/><path fill="#f5e6b8" d="M23 42h74v5H23z"/>
    <path fill="#354e50" d="M25 52h17v18H25zM78 52h17v18H78zM51 57h18v27H51z"/><path fill="#9cd0c2" d="M28 55h11v11H28zM81 55h11v11H81z"/><path fill="#f7dda0" d="M32 55h3v11h-3zM85 55h3v11h-3z"/>
    <path fill="#c8955c" d="M54 60h12v24H54z"/><path fill="#f8d889" d="M62 70h2v3h-2zM44 84h32v5H44zM39 89h42v5H39z"/>
    {building === 'bank' && <g fill="#f3e4be"><path d="M19 48h7v33h-7zM43 48h6v33h-6zM71 48h6v33h-6zM95 48h6v33h-6z"/><path fill="#f2cc69" d="M55 24h10v15H55zM51 28h18v7H51z"/></g>}
    {building === 'hospital' && <path fill="#b8554f" d="M55 20h10v8h8v10h-8v8H55v-8h-8V28h8z"/>}
    {building === 'office' && <g><path fill="#b3c8bd" d="M38 3h44v31H38z"/><path fill="#3c5b60" d="M44 9h12v9H44zM64 9h12v9H64zM44 22h12v9H44zM64 22h12v9H64z"/></g>}
    {building === 'market' && <g><path fill="#f2e5bc" d="M15 43h90v13H15z"/><path fill="#bd6750" d="M15 43h13v13H15zM41 43h13v13H41zM67 43h13v13H67zM93 43h12v13H93z"/><path fill="#7d9b55" d="M17 75h21v8H17zM83 75h22v8H83z"/></g>}
    {building === 'home' && <path fill="#765945" d="M81 6h10v20H81z"/>}
  </svg>
}
export interface TownSceneProps { onBuildingClick: (building: BuildingTarget) => void; eventBuilding?: BuildingTarget | null }
export function TownScene({ onBuildingClick, eventBuilding }: TownSceneProps) {
  return <section className="town-scene" aria-label="Financial Town. Choose a building to explore your finances.">
    <svg className="town-backdrop" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
      <defs><pattern id="grass" width="46" height="38" patternUnits="userSpaceOnUse"><path fill="#89ad65" d="M0 0h46v38H0z"/><path stroke="#98bb72" strokeWidth="3" d="M8 8h5m16 17h5M3 32h4"/><path stroke="#7a9f5c" strokeWidth="2" d="M22 9v4m17 22v3"/></pattern></defs>
      <path fill="url(#grass)" d="M0 0h1000v600H0z"/><path fill="#729454" d="M0 0h1000v44H0zM0 565h1000v35H0z"/><path stroke="#567848" strokeWidth="12" d="M0 43h1000M0 566h1000"/>
      <path stroke="#b79967" strokeWidth="72" fill="none" d="M-10 306h1020M500 105v450M190 185v130M810 185v130M290 310v170M690 310v170"/><path stroke="#ddc68e" strokeWidth="56" fill="none" d="M-10 306h1020M500 105v450M190 185v130M810 185v130M290 310v170M690 310v170"/><path stroke="#ecd6a1" strokeWidth="3" strokeDasharray="8 28" d="M0 287h1000M0 325h1000"/>
      <path fill="#497f82" d="M0 470h115v-10h35v20h30v120H0z"/><path fill="#73b4bc" d="M0 480h100v-10h40v20h30v110H0z"/><path stroke="#a0d0c8" strokeWidth="4" d="M15 499h35m30 25h60M8 553h70m25 30h35"/>
      <path fill="#c3a16d" d="M104 470h67v12h-67zM104 489h67v12h-67zM104 508h67v12h-67z"/><path fill="#b6a77b" d="M460 280h80v52h-80z"/><path fill="#497e79" d="M473 284h54v40h-54z"/><path fill="#92c7bd" d="M479 289h42v28h-42z"/><path fill="#e3d6a7" d="M495 264h10v39h-10zM487 260h26v8h-26z"/>
      {[35,85,135,235,290,345,640,700,755,870,930,980].map((x,i) => <Tree key={`top-${x}`} x={x} y={65 + i%2*12} size={1.2}/>)}
      {[35,220,385,440,555,610,790,855,925,980].map((x,i) => <Tree key={`bottom-${x}`} x={x} y={548 + i%2*10} size={1.2}/>)}
      {[[65,190],[930,190],[65,390],[910,410],[400,155],[600,155],[390,450],[830,490]].map(([x,y]) => <Tree key={`${x}-${y}`} x={x} y={y}/>)}
      {[115,365,615,865].map(x => <g key={x}><path fill="#5b5540" d={`M${x} 258h5v28h-5z`}/><path fill="#f8dc8c" d={`M${x-4} 250h13v11h-13z`}/><path fill="#4c5541" d={`M${x-5} 247h15v4h-15z`}/></g>)}
      {[[95,110],[350,370],[600,220],[850,385],[210,515],[780,140]].map(([x,y]) => <g key={`${x}-${y}`} fill="#e6ce79"><path d={`M${x} ${y}h4v4h-4zM${x+10} ${y+8}h4v4h-4z`}/></g>)}
    </svg>
    <div className="map-location" aria-hidden="true">PINE VALLEY <span>•</span> EST. 2026</div>
    {buildingIds.map(id => <button key={id} className={`town-hotspot hotspot-${id}`} style={{ left: `${buildings[id].x}%`, top: `${buildings[id].y}%` }} onClick={() => onBuildingClick(id)} aria-label={`Open ${buildings[id].title}: ${buildings[id].hint}${eventBuilding === id ? '. Decision waiting' : ''}`}><BuildingSprite building={id}/><span className="building-sign">{buildings[id].title}</span><span className="building-tooltip">{buildings[id].hint} <span aria-hidden="true">↗</span></span>{eventBuilding === id && <span className="event-badge" aria-label="Decision waiting">!</span>}</button>)}
    <div className="map-guide"><span aria-hidden="true">✦</span> Select a building. Shape your story.</div>
  </section>
}
