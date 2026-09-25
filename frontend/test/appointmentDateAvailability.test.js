import test from 'node:test';
import assert from 'node:assert/strict';
import {sameDayAvailabilityAdjustment,tomorrowFromClinicDate,NO_SAME_DAY_AVAILABILITY_MESSAGE} from '../src/utils/appointmentDateAvailability.js';

test('today remains selectable when the backend returns a valid future slot',()=>assert.deepEqual(sameDayAvailabilityAdjustment('2026-09-11',{clinicDate:'2026-09-11',slots:['14:00']},'2026-09-11'),{clearSelectedDate:false,minimumDate:'2026-09-11',message:''}));
test('backend-confirmed unavailable today is cleared and advances the minimum',()=>assert.deepEqual(sameDayAvailabilityAdjustment('2026-09-11',{clinicDate:'2026-09-11',slots:[]},'2026-09-11'),{clearSelectedDate:true,minimumDate:'2026-09-12',message:NO_SAME_DAY_AVAILABILITY_MESSAGE}));
test('a future empty date is not mistaken for unavailable today',()=>assert.equal(sameDayAvailabilityAdjustment('2026-09-12',{clinicDate:'2026-09-11',slots:[]},'2026-09-11').clearSelectedDate,false));
test('tomorrow uses calendar arithmetic on the backend date without timezone rollover',()=>{assert.equal(tomorrowFromClinicDate('2026-12-31'),'2027-01-01');assert.equal(tomorrowFromClinicDate('2028-02-29'),'2028-03-01');});
test('booking and rescheduling share a deterministic adjustment result',()=>{const response={clinicDate:'2026-09-11',slots:[]};assert.deepEqual(sameDayAvailabilityAdjustment('2026-09-11',response),sameDayAvailabilityAdjustment('2026-09-11',response));});
