/** Original geometric illustration; decorative, with no simulated financial data. */
export function TownIllustration() {
  return <div className="welcome-town-art">
    <div className="welcome-town-art-heading"><span className="welcome-section-label">Your financial playground</span><span>Five places to explore</span></div>
    <svg viewBox="0 0 480 330" role="img" aria-labelledby="welcome-town-title">
      <title id="welcome-town-title">A simple town with a bank, office, home, market, and insurance building</title>
      <rect x="12" y="18" width="456" height="282" fill="#dce2b7"/>
      <path d="M12 172h456M240 18v282" stroke="#f5edce" strokeWidth="30"/>
      <path d="M12 172h456M240 18v282" stroke="#b8c198" strokeWidth="1"/>
      <g transform="translate(60 51)"><path d="m0 21 48-21 48 21Z" fill="#7e9470" stroke="#385b48"/><path d="M7 25h82v53H7z" fill="#f5edce" stroke="#385b48"/><path d="M21 31v40M38 31v40M58 31v40M75 31v40" stroke="#7e9470" strokeWidth="5"/><path d="M0 80h96" stroke="#385b48" strokeWidth="4"/><text x="48" y="105">Bank</text></g>
      <g transform="translate(326 40)"><path d="M0 0h68v91H0z" fill="#a9bc8e" stroke="#385b48"/><path d="M10 13h15v15H10zm33 0h15v15H43zM10 41h15v15H10zm33 0h15v15H43z" fill="#f5edce"/><path d="M26 69h18v22H26" fill="#f5edce" stroke="#385b48"/><text x="34" y="117">Office</text></g>
      <g transform="translate(51 210)"><path d="m0 25 44-30 44 30Z" fill="#c09b62" stroke="#385b48"/><path d="M9 25h70v46H9z" fill="#f5edce" stroke="#385b48"/><path d="M35 43h19v28H35M19 36h12v14H19zm39 0h12v14H58z" fill="#b8c89c" stroke="#385b48"/><text x="44" y="95">Home</text></g>
      <g transform="translate(291 216)"><path d="M4 13h65v53H4z" fill="#f5edce" stroke="#385b48"/><path d="M0 0h73l-4 19H4Z" fill="#dfbd73" stroke="#385b48"/><path d="M15 34h21v20H15zm34 0h12v32H49z" fill="#b8c89c" stroke="#385b48"/><text x="36" y="90">Market</text></g>
      <g transform="translate(389 220)"><path d="M0 0h49v61H0z" fill="#c7d3a4" stroke="#385b48"/><path d="M20 10h9v10h10v9H29v10h-9V29H10v-9h10z" fill="#f5edce"/><path d="M18 46h14v15H18" fill="#f5edce" stroke="#385b48"/><text x="24" y="86">Insurance</text></g>
    </svg>
    <p>Every part of your financial life, in one small town.</p>
  </div>
}
