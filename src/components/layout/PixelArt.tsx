export function PixelPortrait({ variant = 0 }: { variant?: number }) {
  const shirts = ['#7289b0', '#537b56', '#b07947', '#ac6570']
  return <svg viewBox="0 0 48 48" className="pixel-portrait" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#283d39" d="M4 4h40v40H4z"/><path fill="#719478" d="M8 8h32v32H8z"/>
    <path fill="#9cb58b" d="M8 8h32v15H8z"/><path fill="#b6c39b" d="M10 11h4v3h-4zM33 17h5v3h-5z"/>
    <path fill="#493d35" d="M16 13h16v15H16zM13 19h4v10h-4z"/>
    <path fill="#e7b380" d="M18 16h12v14H18zM16 20h2v6h-2zM30 20h2v6h-2z"/>
    <path fill="#5e4435" d="M17 13h14v6H17zM17 19h4v3h-4z"/>
    <path fill="#493d35" d="M21 22h2v2h-2zM27 22h2v2h-2z"/><path fill="#b87556" d="M24 27h4v1h-4z"/>
    <path fill={shirts[variant % 4]} d="M15 31h18v9H15zM12 34h24v6H12z"/>
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
    <path fill="#c6dfd4" d="M0 390h170v-50h110v-55h180v55h100v-75h210v70h170v-40h180v70h220v535H0z"/>
    <path fill="#7a9e78" d="M0 510h150v-80h140v35h150v-95h175v65h185v-55h150v80h180v-50h160v65h150v425H0z"/>
    <path fill="#4f785c" d="M0 610h180v-55h180v30h175v-45h180v70h200v-45h175v-35h175v55h175v315H0z"/>
    <path fill="#42684b" d="M0 740h1440v160H0z"/>
    {[30,110,230,360,1070,1210,1320,1420].map((x,i)=><g key={x} transform={`translate(${x} ${650+i%3*55})`}><path fill="#674e38" d="M-7 0H7v75H-7z"/><path fill="#294f3e" d="M-16-100h32v20h18v25h18v38H30V5H-30v-22h-22v-38h18v-25h18z"/><path fill="#61864f" d="M-13-96h23v20h19v22H8v18h-37v-20h15z"/><path fill="#83a35c" d="M-10-90H4v9h-14zM-25-53h15v9h-15z"/></g>)}
    <path fill="#e4ebd9" d="M100 150h40v-12h80v12h40v18H100zM1120 90h30V75h70v15h45v18h-145zM830 220h25v-14h60v14h35v15H830z"/>
    <g fill="#d0b57b"><path d="M0 846h1440v5H0zM0 870h1440v4H0z"/>{Array.from({length:37},(_,i)=><path key={i} d={`M${i*40} 834h7v56h-7z`}/>)}</g>
    <g fill="#cfbb7d">{[45,170,290,1170,1280,1370].map(x=><path key={x} d={`M${x} 801h5v6h-5zM${x+10} 815h4v4h-4z`}/>)}</g>
  </svg></div>
}
