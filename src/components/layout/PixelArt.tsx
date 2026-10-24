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
