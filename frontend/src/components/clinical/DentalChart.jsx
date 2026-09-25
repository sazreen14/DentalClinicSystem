import {useCallback,useEffect,useMemo,useState} from 'react';
import {getDoctorDentalChart,getAdminDentalChart,createDoctorDentalChartEntry,amendDoctorDentalChartEntry} from '../../services/clinicalRecordsApi';
import DentalArch from './DentalArch';
import DentalChartLegend from './DentalChartLegend';
import DentalChartEditor from './DentalChartEditor';
import DentalChartHistory from './DentalChartHistory';
import {ARCHES,resolveEncounter} from './dentalChartUtils';
import {visibleLegendDefinitions} from './dentalChartScope';
import '../../styles/DentalChart.css';

export default function DentalChart({patientId,readOnly=false,originAppointmentId=null,originRecordId=null,historyOutside=false,clinicalPresentation=false}){
  const [chart,setChart]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selectedTooth,setSelectedTooth]=useState(null),[initialSurface,setInitialSurface]=useState(null),[selectedRecordId,setSelectedRecordId]=useState(''),[amending,setAmending]=useState(null);
  const load=useCallback(async()=>{setLoading(true);setError('');try{setChart(readOnly?await getAdminDentalChart(patientId):await getDoctorDentalChart(patientId));}catch(requestError){setError(requestError.message);}finally{setLoading(false);}},[patientId,readOnly]);
  useEffect(()=>{queueMicrotask(load);},[load]);
  const encounters=chart?.eligibleEncounters||[];
  const resolvedRecordId=resolveEncounter(encounters,{selectedRecordId,originRecordId,originAppointmentId})?.recordId||'';
  const byTooth=useMemo(()=>chart?.currentEntries||[],[chart]);
  const legendDefinitions=useMemo(()=>visibleLegendDefinitions(chart?.definitions||[],chart?.history||[]),[chart]);
  function select(tooth,surface=null){setSelectedTooth(tooth);setInitialSurface(surface);setAmending(null);}
  async function save(value){if(amending)await amendDoctorDentalChartEntry(patientId,amending.id,value);else await createDoctorDentalChartEntry(patientId,value);await load();}
  function amend(item){setSelectedTooth(item.toothNumber);setInitialSurface(null);setSelectedRecordId(item.recordId);setAmending(item);}
  if(loading)return <p role="status">Loading Dental Chart…</p>;
  if(error)return <p role="alert">Dental Chart could not be loaded: {error}</p>;
  const clinicalView=!readOnly||clinicalPresentation;
  const history=<DentalChartHistory entries={chart.history} readOnly={readOnly} onAmend={amend} clinicalOnly={clinicalView}/>;
  const chartPanel=<section className="dental-chart"><header className="dental-chart-heading"><div><span>FDI Permanent Dentition · Clinical</span><h3>Interactive Dental Chart</h3><p>{readOnly?'Select a tooth to inspect its recorded clinical markings.':'Select a tooth or surface to add a clinical chart entry.'}</p></div></header>{readOnly&&!clinicalView&&chart.catalogueDisclaimer&&<p className="dental-chart-development">{chart.catalogueDisclaimer}</p>}<div className="dental-chart-layout"><div className="dental-chart-board"><DentalArch label="Upper Arch" teeth={ARCHES.upper} entries={byTooth} selectedTooth={selectedTooth} onSelect={select} readOnly={readOnly}/><DentalArch label="Lower Arch" teeth={ARCHES.lower} entries={byTooth} selectedTooth={selectedTooth} onSelect={select} readOnly={readOnly} lower/></div><DentalChartLegend definitions={legendDefinitions} clinicalOnly={clinicalView}/></div>{!readOnly&&selectedTooth&&<DentalChartEditor key={`${selectedTooth}-${initialSurface||'tooth'}-${amending?.id||'new'}`} tooth={selectedTooth} initialSurface={initialSurface} definitions={chart.definitions} encounters={encounters} selectedRecordId={resolvedRecordId} onRecordChange={setSelectedRecordId} onSave={save} onClose={()=>{setSelectedTooth(null);setAmending(null);}} amending={amending}/>} {!historyOutside&&history}</section>;
  return historyOutside?<>{chartPanel}{history}</>:chartPanel;
}
