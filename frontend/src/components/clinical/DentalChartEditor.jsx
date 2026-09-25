import {useMemo,useState} from 'react';
import {surfacePositions} from './dentalChartUtils';
import {CLINICAL_CHART_ITEMS,clinicalChartSelection,clinicalDefinitionId} from './dentalChartScope';

export default function DentalChartEditor({tooth,initialSurface,definitions,encounters,selectedRecordId,onRecordChange,onSave,onClose,amending}){
  const original=amending?clinicalChartSelection(amending.definition.id):null;
  const legacy=Boolean(amending&&!original);
  const [type,setType]=useState(original?.type||'Condition');
  const [item,setItem]=useState(original?.item||(legacy?'Historical chart item':''));
  const [status,setStatus]=useState(original?.status||'');
  const [surfaces,setSurfaces]=useState(amending?.surfaces||(initialSurface?[initialSurface]:[]));
  const [remark,setRemark]=useState(amending?.remark||'');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const positions=useMemo(()=>surfacePositions(tooth),[tooth]);
  const selectedId=legacy&&item==='Historical chart item'?amending.definition.id:clinicalDefinitionId(type,item,status);
  const selectedDefinition=definitions.find(definition=>definition.id===selectedId);
  const requiresSurfaces=selectedDefinition?.applicationScope==='SURFACES'||selectedDefinition?.applicationScope==='WHOLE_OR_SURFACES';
  const statuses=type==='Treatment'&&item?Object.entries(CLINICAL_CHART_ITEMS.Treatment[item]||{}).filter(([,id])=>definitions.some(definition=>definition.id===id&&definition.active)).map(([value])=>value):[];
  const items=type==='Condition'?Object.keys(CLINICAL_CHART_ITEMS.Condition):Object.keys(CLINICAL_CHART_ITEMS.Treatment);
  if(legacy&&type==='Condition')items.push('Historical chart item');

  function changeType(next){setType(next);setItem('');setStatus('');setSurfaces([]);setError('');}
  function changeItem(next){setItem(next);setStatus('');setSurfaces([]);setError('');}
  function toggle(surface){setSurfaces(current=>surface==='Whole'?(current.includes('Whole')?[]:['Whole']):current.includes(surface)?current.filter(value=>value!==surface):[...current.filter(value=>value!=='Whole'),surface]);}
  async function submit(event){
    event.preventDefault();setError('');
    const selectedSurfaces=requiresSurfaces?surfaces:['Whole'];
    if(!selectedRecordId||!selectedDefinition||(!selectedDefinition.active&&!legacy)){setError('Select a clinical item and encounter.');return;}
    if(requiresSurfaces&&!selectedSurfaces.length){setError('Select a tooth surface or the whole tooth.');return;}
    if(amending&&!reason.trim()){setError('Enter a reason for this correction.');return;}
    setSaving(true);
    try{await onSave({recordId:selectedRecordId,toothNumber:tooth,surfaces:selectedSurfaces,definitionId:selectedDefinition.id,remark,...(amending&&{amendmentReason:reason})});onClose();}
    catch(requestError){setError(requestError.message||'The chart entry could not be saved.');}
    finally{setSaving(false);}
  }

  return <section className="dental-chart-editor"><header><div><span>{amending?'Correct chart entry':'New chart entry'}</span><h4>Tooth {tooth}</h4></div><button type="button" onClick={onClose}>Close</button></header><form onSubmit={submit}>
    <fieldset className="dental-clinical-type"><legend>Clinical Type</legend><div>{['Condition','Treatment'].map(value=><button type="button" key={value} className={type===value?'active':''} aria-pressed={type===value} onClick={()=>changeType(value)}>{value}</button>)}</div></fieldset>
    <label><span>Condition / Treatment</span><select value={item} onChange={event=>changeItem(event.target.value)} required><option value="">Select...</option>{items.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    {type==='Treatment'&&item&&<label><span>Status</span><select value={status} onChange={event=>{setStatus(event.target.value);setSurfaces([]);}} required><option value="">Select status</option>{statuses.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
    {requiresSurfaces&&<fieldset className="dental-editor-surfaces"><legend>Tooth Surface</legend><div className="dental-surface-diagram" aria-label="Select tooth surfaces">{[['top',positions.top],['left',positions.left],['center',positions.center],['right',positions.right],['bottom',positions.bottom]].map(([place,surface])=><button key={surface} type="button" className={`${place} ${surfaces.includes(surface)?'active':''}`} aria-pressed={surfaces.includes(surface)} onClick={()=>toggle(surface)}>{surface}</button>)}</div>{selectedDefinition.applicationScope==='WHOLE_OR_SURFACES'&&<button type="button" className={`dental-whole-choice ${surfaces.includes('Whole')?'active':''}`} aria-pressed={surfaces.includes('Whole')} onClick={()=>toggle('Whole')}>Entire tooth</button>}<small>Select one or more relevant surfaces.</small></fieldset>}
    <label><span>Clinical encounter</span><select value={selectedRecordId} onChange={event=>onRecordChange(event.target.value)} required>{encounters.map(encounter=><option value={encounter.recordId} key={encounter.recordId}>{encounter.date} · {encounter.service}</option>)}</select></label>
    <label className="wide"><span>Clinical Notes <small>(Optional)</small></span><textarea value={remark} onChange={event=>setRemark(event.target.value)} rows="3" maxLength="5000"/></label>
    {amending&&<label className="wide"><span>Correction reason</span><textarea value={reason} onChange={event=>setReason(event.target.value)} rows="2" required maxLength="1000"/></label>}
    {error&&<p role="alert">{error}</p>}
    <div className="dental-editor-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?'Saving…':'Save Chart Entry'}</button></div>
  </form></section>;
}
