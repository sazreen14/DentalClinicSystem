import {surfacesFor} from './dentalChartUtils.js';

export const APPLICATION_SCOPES=Object.freeze(['WHOLE','SURFACES','WHOLE_OR_SURFACES']);

export function applicationAreasFor(tooth,scope){
  const individual=surfacesFor(tooth).filter(surface=>surface!=='Whole');
  if(scope==='WHOLE')return ['Whole'];
  if(scope==='SURFACES')return individual;
  if(scope==='WHOLE_OR_SURFACES')return [...individual,'Whole'];
  return [];
}

export function visibleLegendDefinitions(definitions,history){
  const referenced=new Set(history.map(entry=>entry.definition.id));
  return definitions.filter(definition=>definition.active||referenced.has(definition.id));
}

export const CLINICAL_CHART_ITEMS=Object.freeze({
  Condition:Object.freeze({
    'Caries':Object.freeze({definitionId:'DCD-PROP-CARIES'}),
    'Missing Tooth':Object.freeze({definitionId:'DCD-PROP-MISSING'}),
  }),
  Treatment:Object.freeze({
    'Filling':Object.freeze({Existing:'DCD-PROP-EXIST-FILL',Planned:'DCD-PROP-PLAN-FILL',Completed:'DCD-PROP-COMP-FILL'}),
    'Root Canal Treatment':Object.freeze({Existing:'DCD-PROP-EXIST-RCT',Planned:'DCD-CLIN-PLAN-RCT',Completed:'DCD-PROP-COMP-RCT'}),
    'Crown':Object.freeze({Existing:'DCD-PROP-CROWN',Planned:'DCD-CLIN-PLAN-CROWN',Completed:'DCD-CLIN-COMP-CROWN'}),
    'Extraction':Object.freeze({Planned:'DCD-PROP-PLAN-EXT',Completed:'DCD-PROP-EXTRACTED'}),
  }),
});

export function clinicalChartSelection(definitionId){
  for(const [item,{definitionId:id}] of Object.entries(CLINICAL_CHART_ITEMS.Condition))if(id===definitionId)return {type:'Condition',item,status:''};
  for(const [item,statuses] of Object.entries(CLINICAL_CHART_ITEMS.Treatment))for(const [status,id] of Object.entries(statuses))if(id===definitionId)return {type:'Treatment',item,status};
  return null;
}

export function clinicalDefinitionId(type,item,status){
  return type==='Condition'?CLINICAL_CHART_ITEMS.Condition[item]?.definitionId:CLINICAL_CHART_ITEMS.Treatment[item]?.[status];
}
