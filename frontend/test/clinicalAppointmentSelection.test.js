import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import * as icons from 'react-icons/fa';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

test('new clinical notes require a selected appointment belonging to the current doctor', async () => {
  const source = await readFile(new URL('../src/pages/DoctorPatientRecords.jsx', import.meta.url),'utf8');
  const modal = source.slice(source.indexOf('function ClinicalRecordModal('),source.indexOf('function AmendmentModal('));
  const {code} = await transformWithOxc(modal,'ClinicalRecordModal.jsx',{jsx:{runtime:'classic'}});
  const states=[], saved=[];
  let index=0;
  const bindings={React,...icons,useAuth:()=>({user:{doctorId:'D1',fullName:'Synthetic Doctor'}}),useMemo:fn=>fn(),useState:initial=>{
    const slot=index++; if(!(slot in states)) states[slot]=initial;
    return [states[slot],value=>{states[slot]=typeof value==='function'?value(states[slot]):value;}];
  }};
  const Modal=new Function(...Object.keys(bindings),`${code}\nreturn ClinicalRecordModal;`)(...Object.values(bindings));
  const props={patient:{name:'Synthetic Patient',patientId:'P1',visitAppointments:[
    {id:'OWN',doctorId:'D1',status:'Confirmed',date:'2026-01-01',service:'Consultation'},
    {id:'OTHER',doctorId:'D2',status:'Confirmed'},
    {id:'PENDING',doctorId:'D1',status:'Pending'},
  ]},originAppointmentId:'OTHER',onSave:async value=>saved.push(value),onClose:()=>{}};
  const render=()=>{index=0;return Modal(props);};
  function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;return React.Children.toArray(node.props?.children).map(child=>find(child,predicate)).find(Boolean);}
  const field=name=>find(render(),node=>node.props?.name===name);
  assert.equal(field('appointmentId').props.value,'');
  const html=renderToStaticMarkup(field('appointmentId'));
  assert.match(html,/OWN/);assert.doesNotMatch(html,/OTHER|PENDING/);
  for(const name of ['treatment','diagnosis','procedure','clinicalNote','prescription','followUp']) field(name).props.onChange({target:{name,value:'Synthetic value'}});
  await find(render(),node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(saved.length,0);
  field('appointmentId').props.onChange({target:{name:'appointmentId',value:'OWN'}});
  await find(render(),node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(saved[0].appointmentId,'OWN');
});
