import {displayDate} from './dentalChartUtils';

export default function DentalChartHistory({entries,readOnly,onAmend,clinicalOnly=false}){
  const superseded=new Set(entries.map(item=>item.supersedesEntryId).filter(Boolean));
  return <section className="dental-chart-history">
    <header><div><span>{readOnly?'Append-only record':'Chart record'}</span><h4>Chart History</h4></div>{!readOnly&&<small>{entries.length} chart {entries.length===1?'entry':'entries'}</small>}</header>
    {entries.length?entries.map(item=><article key={item.id}>
      <div className="dental-chart-history-content">
        <strong>Tooth {item.toothNumber} · {clinicalOnly&&item.definition.developmentOnly?'Historical chart entry':item.definition.label}{!clinicalOnly&&item.definition.developmentOnly?' · Legacy / UAT':''}</strong>
        <span>{item.surfaces.join(', ')}</span>
        <small>{displayDate(item.createdAt)} · {item.doctor} · {item.recordId}</small>
        {item.remark&&<p>{item.remark}</p>}
        {item.supersedesEntryId&&<em>Amends {item.supersedesEntryId}</em>}
      </div>
      {!readOnly&&!superseded.has(item.id)&&<button type="button" onClick={()=>onAmend(item)}>Amend</button>}
    </article>):<p className="dental-chart-empty">No Dental Chart history recorded.</p>}
  </section>;
}
