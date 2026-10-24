/** All scenery is assembled from separately authored, palette-limited sprites. */
export function TitleScene({ dusk = false }: { dusk?: boolean }) {
  return <div className={`fv-valley ${dusk ? 'fv-valley--dusk' : ''}`} aria-hidden="true">
    <div className="fv-sky-band"/><div className="fv-mountains fv-mountains--far"/>
    <div className="fv-haze fv-haze--far"/><div className="fv-mountains fv-mountains--mid"/>
    <div className="fv-haze fv-haze--near"/><div className="fv-mountains fv-mountains--near"/>
    <div className="fv-forest"/><div className="fv-meadow"/>
    <div className="fv-valley-path"/>
    <img className="fv-cottage fv-cottage--one" src="/art/title/cottage.png" width="24" height="20" alt=""/>
    <img className="fv-cottage fv-cottage--two" src="/art/title/cottage-blue.png" width="24" height="20" alt=""/>
    <img className="fv-cottage fv-cottage--three" src="/art/title/cottage.png" width="24" height="20" alt=""/>
    <div className="fv-flowers"/>
  </div>
}
