import {surfacePositions} from './dentalChartUtils';

export default function DentalTooth({number,entries,selected,onSelect,readOnly}){
  const positions=surfacePositions(number);const marked={};for(const entry of entries){for(const surface of entry.surfaces){marked[surface]=entry.definition.color;}if(entry.surfaces.includes('Whole'))marked.Whole=entry.definition.color;}
  const color=surface=>marked[surface]||'#ffffff';
  const choose=surface=>{if(!readOnly)onSelect(number,surface);else onSelect(number);};
  return <div className={`dental-tooth ${selected?'selected':''}`}><button type="button" className="dental-tooth-number" onClick={()=>onSelect(number)} aria-label={`Tooth ${number}`}>{number}</button><svg viewBox="0 0 100 100" role="group" aria-label={`Tooth ${number} surfaces`}>
    <path d="M8 10 Q50 1 92 10 L75 34 L25 34 Z" fill={color(positions.top)} onClick={()=>choose(positions.top)} tabIndex={readOnly?-1:0}/>
    <path d="M8 10 L25 34 L25 66 L8 90 Q1 50 8 10" fill={color(positions.left)} onClick={()=>choose(positions.left)} tabIndex={readOnly?-1:0}/>
    <path d="M92 10 L75 34 L75 66 L92 90 Q99 50 92 10" fill={color(positions.right)} onClick={()=>choose(positions.right)} tabIndex={readOnly?-1:0}/>
    <path d="M25 66 L75 66 L92 90 Q50 99 8 90 Z" fill={color(positions.bottom)} onClick={()=>choose(positions.bottom)} tabIndex={readOnly?-1:0}/>
    <path d="M25 34 L75 34 L75 66 L25 66 Z" fill={color(positions.center)} onClick={()=>choose(positions.center)} tabIndex={readOnly?-1:0}/>
    {marked.Whole&&<path className="whole-mark" d="M8 10 Q50 1 92 10 Q99 50 92 90 Q50 99 8 90 Q1 50 8 10Z" fill="none" stroke={marked.Whole}/>} 
  </svg>{entries.length>0&&<span className="dental-tooth-mark-count">{entries.length}</span>}</div>;
}
