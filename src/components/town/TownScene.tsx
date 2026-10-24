import type { BuildingId } from '../../types/domain'
import { buildingIds, buildings } from './buildings'

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path fill="#658948" d="M-17 13h34v6h-34z"/>
    <path fill="#65452e" d="M-5-4H5v24H-5z"/><path fill="#a27742" d="M-3 0h3v18h-3z"/>
    <path fill="#365d37" d="M-12-28h24v6h8v8h5V3h-7v7H7v4H-8v-4h-12V3h-5v-17h5v-8h8z"/>
    <path fill="#54853e" d="M-10-28h20v6h8v8h4v12H12v6H-8v-4h-12v-14h4v-10h6z"/>
    <path fill="#79a84c" d="M-8-26H7v5h7v7H5v5H-8v5h-11v-9h5v-8h6z"/>
    <path fill="#9cc45b" d="M-6-24h10v4H-6zM-13-17h6v4h-6zM2-10h8v4H2z"/>
    <path fill="#416d36" d="M-13 3h9v4h-9zM12-7h7v4h-7z"/>
  </g>
}

function FlowerBed({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path fill="#89633c" d="M0 0h48v16H0z"/><path fill="#a98450" d="M0 13h48v5H0z"/>
    {[5,17,29,41].map((left,i) => <g key={left}><path fill="#4d783a" d={`M${left} 2h3v10h-3zM${left-3} 7h3v3h-3z`}/><path fill={i%2 ? '#f7c65c' : '#df8a91'} d={`M${left-2} -2h7v7h-7z`}/><path fill="#ffedaa" d={`M${left} 0h3v3h-3z`}/></g>)}
  </g>
}

function Fence({ x, y, length = 80 }: { x: number; y: number; length?: number }) {
  return <g transform={`translate(${x} ${y})`}><path fill="#8d663e" d={`M0 1h${length}v5H0zM0 12h${length}v5H0z`}/>{Array.from({length:Math.floor(length/16)+1},(_,i)=><g key={i}><path fill="#805536" d={`M${i*16} -6h6v29h-6z`}/><path fill="#d8b778" d={`M${i*16} -6h4v26h-4z`}/></g>)}</g>
}
export function BuildingSprite({ building }: { building: BuildingId }) {
  return <svg viewBox="0 0 120 100" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#244433" opacity=".3" d="M8 88h108v9H8z"/><path fill="#514538" d="M15 38h90v50H15z"/><path fill={buildings[building].color} d="M19 38h82v46H19z"/>
    <path fill={building === 'home' ? '#a65345' : building === 'market' ? '#568368' : '#526c77'} d="M7 37v-8h10v-9h13v-9h60v9h13v9h10v8z"/>
    <path fill={building === 'home' ? '#d07c56' : '#79929a'} d="M22 27h76v5H22zM33 17h54v5H33z"/><path fill="#f5e6b8" d="M23 42h74v5H23z"/>
    <g fill={building === 'home' ? '#e79a67' : '#9cafa0'} opacity=".8"><path d="M35 13h8v2h-8zM51 13h8v2h-8zM67 13h8v2h-8zM28 22h9v2h-9zM45 22h9v2h-9zM62 22h9v2h-9zM79 22h9v2h-9zM18 32h9v2h-9zM36 32h9v2h-9zM54 32h9v2h-9zM72 32h9v2h-9zM90 32h9v2h-9z"/></g>
    <path fill="#8d6848" opacity=".45" d="M19 48h82v2H19zM19 73h82v2H19zM19 80h82v2H19zM20 51h5v2h-5zM44 55h5v2h-5zM72 71h6v2h-6zM94 77h5v2h-5z"/>
    <path fill="#354e50" d="M25 52h17v18H25zM78 52h17v18H78zM51 57h18v27H51z"/><path fill="#9cd0c2" d="M28 55h11v11H28zM81 55h11v11H81z"/><path fill="#f7dda0" d="M32 55h3v11h-3zM85 55h3v11h-3z"/>
    <path fill="#c8955c" d="M54 60h12v24H54z"/><path fill="#f8d889" d="M62 70h2v3h-2zM44 84h32v5H44zM39 89h42v5H39z"/>
    <path fill="#a66f42" d="M54 62h12v2H54zM56 65h2v17h-2zM24 70h19v3H24zM77 70h19v3H77z"/>
    <path fill="#d8a161" d="M23 74h20v7H23zM77 74h20v7H77z"/><path fill="#4f7e43" d="M25 72h16v5H25zM79 72h16v5H79z"/><path fill="#ed9b9b" d="M27 70h3v4h-3zM35 71h3v4h-3zM81 71h3v4h-3zM89 70h3v4h-3z"/>
    {building === 'bank' && <g fill="#f3e4be"><path d="M19 48h7v33h-7zM43 48h6v33h-6zM71 48h6v33h-6zM95 48h6v33h-6z"/><path fill="#f2cc69" d="M55 24h10v15H55zM51 28h18v7H51z"/></g>}
    {building === 'hospital' && <path fill="#b8554f" d="M55 20h10v8h8v10h-8v8H55v-8h-8V28h8z"/>}
    {building === 'office' && <g><path fill="#b3c8bd" d="M38 3h44v31H38z"/><path fill="#3c5b60" d="M44 9h12v9H44zM64 9h12v9H64zM44 22h12v9H44zM64 22h12v9H64z"/></g>}
    {building === 'market' && <g><path fill="#f2e5bc" d="M15 43h90v13H15z"/><path fill="#bd6750" d="M15 43h13v13H15zM41 43h13v13H41zM67 43h13v13H67zM93 43h12v13H93z"/><path fill="#7d9b55" d="M17 75h21v8H17zM83 75h22v8H83z"/></g>}
    {building === 'home' && <path fill="#765945" d="M81 6h10v20H81z"/>}
  </svg>
}
export interface TownSceneProps { onBuildingClick: (building: BuildingId) => void; eventBuilding?: BuildingId | null; eventBuildings?: BuildingId[] }
export function TownScene({ onBuildingClick, eventBuilding, eventBuildings = [] }: TownSceneProps) {
  return <section className="town-scene" aria-label="Financial Town. Choose a building to explore your finances.">
    <svg className="town-backdrop" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
      <defs><pattern id="grass" width="46" height="38" patternUnits="userSpaceOnUse"><path fill="#95b957" d="M0 0h46v38H0z"/><path stroke="#b0cc6b" strokeWidth="2" d="M8 8h5m16 17h5M3 32h4M39 4h3"/><path stroke="#80a447" strokeWidth="2" d="M22 9v4m17 22v3M12 23v3M6 22v3"/><path fill="#a6c561" d="M18 28h5v2h-5zM33 12h4v2h-4z"/></pattern><pattern id="water" width="60" height="35" patternUnits="userSpaceOnUse"><path fill="#65aebb" d="M0 0h60v35H0z"/><path fill="#88c8cc" d="M4 6h18v3H4zM33 23h20v2H33z"/><path fill="#5598ae" d="M24 12h12v2H24zM5 31h14v2H5z"/></pattern></defs>
      <path fill="url(#grass)" d="M0 0h1000v600H0z"/><path fill="#729454" d="M0 0h1000v44H0zM0 565h1000v35H0z"/><path stroke="#567848" strokeWidth="12" d="M0 43h1000M0 566h1000"/>
      <path stroke="#b79967" strokeWidth="72" fill="none" d="M-10 306h1020M500 105v450M190 185v130M810 185v130M290 310v170M690 310v170"/><path stroke="#ddc68e" strokeWidth="56" fill="none" d="M-10 306h1020M500 105v450M190 185v130M810 185v130M290 310v170M690 310v170"/><path stroke="#ecd6a1" strokeWidth="3" strokeDasharray="8 28" d="M0 287h1000M0 325h1000"/>
      <path fill="#d7c58b" d="M0 466h117v-10h37v20h30v124H0z"/><path fill="#497f82" d="M0 470h115v-10h35v20h30v120H0z"/><path fill="url(#water)" d="M0 480h100v-10h40v20h30v110H0z"/><path stroke="#a0d0c8" strokeWidth="3" d="M15 499h35m30 25h60M8 553h70m25 30h35"/>
      <path fill="#c3a16d" d="M104 470h67v12h-67zM104 489h67v12h-67zM104 508h67v12h-67z"/><path fill="#b6a77b" d="M460 280h80v52h-80z"/><path fill="#497e79" d="M473 284h54v40h-54z"/><path fill="#92c7bd" d="M479 289h42v28h-42z"/><path fill="#e3d6a7" d="M495 264h10v39h-10zM487 260h26v8h-26z"/>
      {[35,85,135,235,290,345,640,700,755,870,930,980].map((x,i) => <Tree key={`top-${x}`} x={x} y={65 + i%2*12} size={1.2}/>)}
      {[35,220,385,440,555,610,790,855,925,980].map((x,i) => <Tree key={`bottom-${x}`} x={x} y={548 + i%2*10} size={1.2}/>)}
      {([[65,190],[930,190],[65,390],[910,410],[400,155],[600,155],[390,450],[830,490]] as const).map(([x,y]) => <Tree key={`${x}-${y}`} x={x} y={y}/>)}
      <Fence x={95} y={225} length={70}/><Fence x={220} y={225} length={70}/><Fence x={720} y={225} length={50}/><Fence x={840} y={225} length={70}/><Fence x={205} y={500} length={55}/><Fence x={320} y={500} length={55}/>
      <FlowerBed x={110} y={235}/><FlowerBed x={230} y={235}/><FlowerBed x={725} y={237}/><FlowerBed x={845} y={237}/><FlowerBed x={600} y={493}/><FlowerBed x={738} y={493}/>
      <g fill="#8a9b73"><path d="M46 438h18v5h7v10H41v-10h5zM953 358h17v5h7v10h-31v-10h7z"/><path fill="#bbc09a" d="M47 438h14v5H47zM954 358h13v5h-13z"/></g>
      <g fill="#a67b48"><path d="M369 352h34v6h-34zM371 359h30v4h-30zM373 363h4v10h-4zM395 363h4v10h-4zM579 352h34v6h-34zM581 359h30v4h-30zM583 363h4v10h-4zM605 363h4v10h-4z"/></g>
      {[115,365,615,865].map(x => <g key={x}><path fill="#5b5540" d={`M${x} 258h5v28h-5z`}/><path fill="#f8dc8c" d={`M${x-4} 250h13v11h-13z`}/><path fill="#4c5541" d={`M${x-5} 247h15v4h-15z`}/></g>)}
      {([[95,110],[350,370],[600,220],[850,385],[210,515],[780,140]] as const).map(([x,y]) => <g key={`${x}-${y}`} fill="#e6ce79"><path d={`M${x} ${y}h4v4h-4zM${x+10} ${y+8}h4v4h-4z`}/></g>)}
    </svg>
    <div className="map-location" aria-hidden="true">PINE VALLEY <span>•</span> EST. 2026</div>
    {buildingIds.map(id => <button key={id} className={`town-hotspot hotspot-${id}`} style={{ left: `${buildings[id].x}%`, top: `${buildings[id].y}%` }} onClick={() => onBuildingClick(id)} aria-label={`Open ${buildings[id].title}: ${buildings[id].hint}${eventBuilding === id || eventBuildings.includes(id) ? '. Decision waiting' : ''}`}><BuildingSprite building={id}/><span className="building-sign">{buildings[id].title}</span><span className="building-tooltip">{buildings[id].hint} <span aria-hidden="true">↗</span></span>{(eventBuilding === id || eventBuildings.includes(id)) && <span className="event-badge" aria-label="Decision waiting">!</span>}</button>)}
    <div className="map-guide"><span aria-hidden="true">✦</span> Select a building. Shape your story.</div>
  </section>
}
