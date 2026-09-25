import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationAreasFor,visibleLegendDefinitions} from '../src/components/clinical/dentalChartScope.js';

test('WHOLE exposes only the canonical whole-tooth control',()=>assert.deepEqual(applicationAreasFor('14','WHOLE'),['Whole']));
test('SURFACES exposes only anatomically valid individual surfaces',()=>{const values=applicationAreasFor('14','SURFACES');assert.ok(values.includes('Occlusal'));assert.equal(values.includes('Whole'),false);});
test('WHOLE_OR_SURFACES exposes both modes',()=>{const values=applicationAreasFor('11','WHOLE_OR_SURFACES');assert.ok(values.includes('Incisal'));assert.ok(values.includes('Whole'));});
test('invalid or missing scopes expose no application controls',()=>{assert.deepEqual(applicationAreasFor('14','INVALID'),[]);assert.deepEqual(applicationAreasFor('14',undefined),[]);});
test('legend includes active definitions and referenced inactive history only',()=>{const definitions=[{id:'active',active:true},{id:'legacy-used',active:false},{id:'legacy-unused',active:false}];const history=[{definition:{id:'legacy-used'}}];assert.deepEqual(visibleLegendDefinitions(definitions,history).map(item=>item.id),['active','legacy-used']);});
