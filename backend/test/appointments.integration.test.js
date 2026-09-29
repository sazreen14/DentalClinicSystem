import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import * as appointments from '../src/services/appointmentService.js';
import { getAvailability } from '../src/services/appointmentAvailabilityService.js';
import {setAppointmentEmailSenderForTests} from '../src/services/appointmentEmailEventService.js';
import {env} from '../src/config/env.js';
import {cleanupKnownIntegrationFixtures} from './helpers/databaseFixtureCleanup.js';
import * as identity from '../src/services/identityService.js';
import * as clinicalRecords from '../src/services/clinicalRecordsService.js';

const suffix=Date.now().toString(36).toUpperCase();
const ids={patientUser:null,otherUser:null,adminUser:null,doctorUser:null,patient:null,otherPatient:null,doctor:null,service:null};
const nextWeekday=(wanted,offset=1)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);while(d.getUTCDay()!==wanted)d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
const monday=nextWeekday(1,14),tuesday=nextWeekday(2,15);
const firstSaturday=(monthOffset)=>{const today=new Date();const first=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+monthOffset,1));const offset=(6-first.getUTCDay()+7)%7;first.setUTCDate(1+offset);return first.toISOString().slice(0,10);};
const plusDays=(value,days)=>{const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
const emailEvents=[];const externalAppointmentIds=[];
let cleaned=false;
let walkInUserId=null;
async function cleanup(){if(cleaned)return;setAppointmentEmailSenderForTests(null);await cleanupKnownIntegrationFixtures(db,{family:'appointments',tag:suffix});if(walkInUserId){await db.execute('DELETE FROM notifications WHERE recipient_user_id=?',[walkInUserId]);await db.execute('DELETE FROM security_audit_logs WHERE user_id=?',[walkInUserId]);await db.execute('DELETE FROM patient_clinical_profiles WHERE patient_id IN (SELECT id FROM patients WHERE user_id=?)',[walkInUserId]);await db.execute('DELETE FROM patients WHERE user_id=?',[walkInUserId]);await db.execute('DELETE FROM users WHERE id=?',[walkInUserId]);}await db.execute("DELETE FROM clinic_closed_dates WHERE reason=?",[`TEST-${suffix}`]);env.bookingDoctorIds.delete(`DOC-${suffix}`);cleaned=true;}

async function user(role,name,tag){const [r]=await db.execute("INSERT INTO users(email_verified_at,user_id,full_name,email,password_hash,role) VALUES(CURRENT_TIMESTAMP,?,?,?,?,?)",[`UT-${tag}-${suffix}`,name,`${tag.toLowerCase()}.${suffix}@example.test`,'$2b$12$syntheticAppointmentTestHashOnly000000000000000000000',role]);return r.insertId;}
before(async()=>{
  env.bookingDoctorIds.add(`DOC-${suffix}`);
  setAppointmentEmailSenderForTests(async(event,appointment,recipient)=>{emailEvents.push({event,appointmentId:appointment.id,recipient});return{status:'test'};});
  await db.execute("DELETE FROM users WHERE user_id LIKE ?",[`%-${suffix}`]);
  ids.patientUser=await user('Patient','Appointment Test Patient','PAT');ids.otherUser=await user('Patient','Other Test Patient','OTH');ids.adminUser=await user('Admin','Appointment Test Admin','ADM');ids.doctorUser=await user('Doctor','Appointment Test Doctor','DOC');
  let r;[r]=await db.execute("INSERT INTO patients(patient_id,user_id,date_of_birth,gender,phone_ciphertext,phone_blind_index,phone_key_version,registration_date) VALUES(?,?,?,'Female',?,?,1,CURRENT_DATE)",[`PT-${suffix}`,ids.patientUser,'1990-01-01','encrypted-only',`${suffix.padEnd(64,'0').slice(0,64)}`]);ids.patient=r.insertId;
  [r]=await db.execute("INSERT INTO patients(patient_id,user_id,date_of_birth,gender,phone_ciphertext,phone_blind_index,phone_key_version,registration_date) VALUES(?,?,?,'Male',?,?,1,CURRENT_DATE)",[`PT-O-${suffix}`,ids.otherUser,'1991-01-01','encrypted-only',`${('F'+suffix).padEnd(64,'1').slice(0,64)}`]);ids.otherPatient=r.insertId;
  [r]=await db.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)",[`DOC-${suffix}`,ids.doctorUser,'Dentist',`LIC-${suffix}`]);ids.doctor=r.insertId;
  [r]=await db.execute("INSERT INTO dental_services(service_code,name,duration_minutes,status) VALUES(?,?,60,'Active')",[`SVC-${suffix}`,'Synthetic Appointment Service']);ids.service=r.insertId;
  await db.execute("INSERT INTO doctor_working_hours(doctor_id,day_of_week,is_working,start_time,end_time) VALUES(?, 'Monday',1,'09:00','18:00'),(?, 'Tuesday',1,'09:00','18:00')",[ids.doctor,ids.doctor]);
  for(const time of ['09:00','09:30','10:00','11:00','12:00','12:30','13:00','13:30','14:00']) await db.execute("INSERT INTO appointment_time_slots(doctor_id,slot_time,is_enabled) VALUES(?,?,1)",[ids.doctor,time]);
});
after(cleanup);

test('appointment lifecycle enforces availability, ownership, history and encryption',async()=>{
  const created=await appointments.create(ids.patientUser,{patientId:`PT-O-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:monday,time:'09:00',patientNote:'synthetic private appointment note'});
  assert.equal(created.status,'Pending');assert.equal(created.patientId,`PT-${suffix}`);assert.equal((await appointments.patientList(ids.patientUser)).length,1);assert.equal((await appointments.patientList(ids.otherUser)).length,0);assert.equal((await appointments.doctorList(ids.doctorUser)).length,1);
  await assert.rejects(()=>appointments.patientCancel(ids.otherUser,created.id,'not mine'),/not found/i);
  await assert.rejects(()=>appointments.create(ids.otherUser,{dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:monday,time:'09:30'}),/no longer available/i);
  const [stored]=await db.execute("SELECT patient_note_ciphertext FROM appointments WHERE appointment_id=?",[created.id]);assert.ok(!stored[0].patient_note_ciphertext.includes('synthetic private appointment note'));
  const options=await appointments.options();assert.deepEqual(new Set(options.doctors.map(x=>x.id)),new Set(['DOC-DEV-ROSNI','DOC-DEV-DOCTOR-B','DOC-CLINIC-NORA',`DOC-${suffix}`]));
  const sameClockOtherDoctor=await appointments.create(ids.otherUser,{dentalServiceId:`SVC-${suffix}`,doctorId:'DOC-DEV-DOCTOR-B',date:monday,time:'09:00'});externalAppointmentIds.push(sameClockOtherDoctor.id);assert.equal(sameClockOtherDoctor.doctorId,'DOC-DEV-DOCTOR-B');assert.equal(sameClockOtherDoctor.status,'Pending');
  await appointments.adminConfirm(ids.adminUser,created.id);const rescheduled=await appointments.patientReschedule(ids.patientUser,created.id,{date:tuesday,time:'10:00',reason:'synthetic private reschedule reason'});assert.equal(rescheduled.status,'Pending');const cancelled=await appointments.patientCancel(ids.patientUser,created.id,'synthetic private cancellation reason');assert.equal(cancelled.status,'Cancelled');
  const available=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:tuesday});assert.ok(available.slots.includes('10:00'));
  const replacement=await appointments.create(ids.otherUser,{dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'10:00'});await appointments.adminConfirm(ids.adminUser,replacement.id);await appointments.adminCancel(ids.adminUser,replacement.id,'synthetic admin cancellation reason');
  const [patientNotifications]=await db.execute("SELECT type,message_ciphertext FROM notifications WHERE recipient_user_id=? AND related_entity_id=?",[ids.patientUser,created.id]);assert.deepEqual(patientNotifications.map(x=>x.type).sort(),['appointment-confirmed']);assert.ok(patientNotifications.every(x=>!x.message_ciphertext.includes('Synthetic Appointment Service')));
  const [adminNotifications]=await db.execute("SELECT type FROM notifications WHERE recipient_user_id=? AND related_entity_id=?",[ids.adminUser,created.id]);assert.deepEqual(adminNotifications.map(x=>x.type).sort(),['appointment-cancelled','new-appointment','reschedule-request']);
  const [otherPatientNotifications]=await db.execute("SELECT type FROM notifications WHERE recipient_user_id=? AND related_entity_id=?",[ids.otherUser,replacement.id]);assert.deepEqual(otherPatientNotifications.map(x=>x.type).sort(),['appointment-cancelled','appointment-confirmed']);
  assert.deepEqual(emailEvents.map(x=>x.event),['booked','booked','confirmed','rescheduled','patientCancelled','booked','confirmed','adminCancelled']);assert.ok(emailEvents.every(x=>x.recipient.endsWith('@example.test')));
  const [history]=await db.execute("SELECT action,new_status,reason_ciphertext FROM appointment_history WHERE appointment_id=(SELECT id FROM appointments WHERE appointment_id=?) ORDER BY id",[created.id]);assert.deepEqual(history.map(x=>x.action),['Created','Confirmed','Rescheduled','Cancelled']);assert.equal(history[0].new_status,'Pending');assert.ok(!history[2].reason_ciphertext.includes('synthetic private reschedule reason'));assert.ok(!history[3].reason_ciphertext.includes('synthetic private cancellation reason'));
  const [audit]=await db.execute("SELECT event_type,metadata FROM security_audit_logs WHERE user_id IN (?,?) AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.appointmentId'))=?",[ids.patientUser,ids.adminUser,created.id]);assert.deepEqual(new Set(audit.map(x=>x.event_type)),new Set(['APPOINTMENT_CREATED','APPOINTMENT_CONFIRMED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED']));assert.ok(audit.every(x=>!JSON.stringify(x.metadata).includes('synthetic private')));
});

test('transactional booking permits one winner for the same Doctor interval',async()=>{
  const attempts=await Promise.allSettled([
    appointments.create(ids.patientUser,{dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'11:00'}),
    appointments.create(ids.otherUser,{dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'11:30'}),
  ]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.filter(x=>x.status==='rejected').length,1);
});

test('admin creates for a selected patient with a recorded source and cannot double book',async()=>{
  const created=await appointments.adminCreate(ids.adminUser,{patientId:`PT-O-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'14:00',bookingSource:'WhatsApp',patientNote:'Admin entered note'});
  assert.equal(created.patientId,`PT-O-${suffix}`);
  assert.equal(created.bookingSource,'WhatsApp');
  const [[stored]]=await db.execute('SELECT booking_source FROM appointments WHERE appointment_id=?',[created.id]);
  assert.equal(stored.booking_source,'WhatsApp');
  await assert.rejects(()=>appointments.adminCreate(ids.adminUser,{patientId:`PT-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'14:00',bookingSource:'Phone'}),/no longer available/i);
  await assert.rejects(()=>appointments.adminCreate(ids.adminUser,{patientId:'PT-NOT-FOUND',dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:monday,time:'10:00',bookingSource:'Admin'}),/profile is unavailable/i);
});
test('admin creates a new patient without portal credentials and rolls back duplicate or unavailable bookings',async()=>{
  const input={fullName:`Walk In ${suffix}`,phone:'+60123456789',email:'',identityNumber:'',dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:tuesday,time:'12:00',bookingSource:'Walk-in',patientNote:''};
  const created=await appointments.adminCreateForNewPatient(ids.adminUser,input);
  const [[row]]=await db.execute('SELECT u.id,u.email,p.date_of_birth,p.gender FROM patients p JOIN users u ON u.id=p.user_id WHERE p.patient_id=?',[created.patientId]);
  walkInUserId=row.id;
  assert.equal(row.email,null);assert.equal(row.date_of_birth,null);assert.equal(row.gender,null);
  assert.equal(created.bookingSource,'Walk-in');
  assert.equal((await identity.getPatient(created.patientId)).fullName,input.fullName);
  const patientRecord=await clinicalRecords.adminRecord(created.patientId);
  assert.equal(patientRecord.name,input.fullName);assert.equal(patientRecord.dateOfBirth,null);
  assert.ok((await appointments.adminList()).some(appointment=>appointment.id===created.id));
  await assert.rejects(()=>appointments.adminCreateForNewPatient(ids.adminUser,{...input,date:monday,time:'12:00'}),/already exists/i);
  const [[count]]=await db.execute('SELECT COUNT(*) AS total FROM patients p JOIN users u ON u.id=p.user_id WHERE u.full_name=?',[input.fullName]);assert.equal(Number(count.total),1);
  const unavailable={...input,fullName:`Blocked ${suffix}`,phone:'+60129876543',date:tuesday,time:'12:30'};
  await assert.rejects(()=>appointments.adminCreateForNewPatient(ids.adminUser,unavailable),/no longer available/i);
  const [[rolledBack]]=await db.execute('SELECT COUNT(*) AS total FROM users WHERE full_name=?',[unavailable.fullName]);assert.equal(Number(rolledBack.total),0);
});

test('email transport failure does not roll back an appointment',async()=>{
  setAppointmentEmailSenderForTests(async()=>{throw new Error('synthetic transport outage');});
  const created=await appointments.create(ids.patientUser,{dentalServiceId:`SVC-${suffix}`,doctorId:`DOC-${suffix}`,date:monday,time:'11:00'});
  const [[stored]]=await db.execute('SELECT status FROM appointments WHERE appointment_id=?',[created.id]);
  assert.equal(stored.status,'Pending');
  setAppointmentEmailSenderForTests(async(event,appointment,recipient)=>{emailEvents.push({event,appointmentId:appointment.id,recipient});return{status:'test'};});
});

test('closed, disabled and blocked slots are rejected',async()=>{
  await db.execute("INSERT INTO clinic_closed_dates(closed_date,reason) VALUES(?,?)",[tuesday,`TEST-${suffix}`]);let result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:tuesday});assert.deepEqual(result.slots,[]);await db.execute("DELETE FROM clinic_closed_dates WHERE closed_date=?",[tuesday]);
  await db.execute("UPDATE appointment_time_slots SET is_enabled=0 WHERE doctor_id=? AND slot_time='10:00:00'",[ids.doctor]);result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:tuesday});assert.ok(!result.slots.includes('10:00'));
  await db.execute("INSERT INTO doctor_blocked_times(doctor_id,blocked_date,start_time,end_time,reason) VALUES(?,?, '11:00','12:00','test')",[ids.doctor,tuesday]);result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:tuesday});assert.ok(!result.slots.includes('11:00'));
});
test('recurring break rejects every overlapping interval and permits exact boundaries',async()=>{const result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:monday});assert.ok(result.slots.includes('12:00'));assert.ok(!result.slots.includes('12:30'));assert.ok(!result.slots.includes('13:00'));assert.ok(!result.slots.includes('13:30'));assert.ok(result.slots.includes('14:00'));});
test('clinic doctor names come from the database and the visiting doctor has no unsafe weekly availability',async()=>{
  const options=await appointments.options();
  assert.equal(options.doctors.find(x=>x.id==='DOC-DEV-ROSNI')?.name,'Dr. Rosni binti Adam');
  assert.equal(options.doctors.find(x=>x.id==='DOC-DEV-DOCTOR-B')?.name,'Dr. Muhammad Nur Syahidi bin Sahnon');
  assert.equal(options.doctors.find(x=>x.id==='DOC-CLINIC-NORA')?.name,'Dr. Nora Rizka binti Mohamad');
  const available=await getAvailability(db,{doctorCode:'DOC-CLINIC-NORA',serviceCode:`SVC-${suffix}`,date:monday});
  assert.deepEqual(available.slots,[]);
});
test('Nora is bookable only on first Saturdays through shared booking and reschedule checks',async()=>{
  const first=firstSaturday(2),nextMonth=firstSaturday(3),second=plusDays(first,7),third=plusDays(first,14),fourth=plusDays(first,21),weekday=plusDays(first,2),sunday=plusDays(first,1);
  const lookup=(date)=>getAvailability(db,{doctorCode:'DOC-CLINIC-NORA',serviceCode:`SVC-${suffix}`,date});
  const valid=await lookup(first);assert.ok(valid.slots.includes('09:00'));assert.ok(valid.slots.includes('12:00'));assert.ok(valid.slots.includes('14:00'));
  assert.ok((await lookup(nextMonth)).slots.includes('09:00'));
  for(const date of [second,third,fourth,weekday,sunday])assert.deepEqual((await lookup(date)).slots,[],date);
  const [extraSlot]=await db.execute("INSERT INTO appointment_time_slots(doctor_id,slot_time,is_enabled) VALUES((SELECT id FROM doctors WHERE doctor_id='DOC-CLINIC-NORA'),'13:00',1)");
  try{assert.ok(!(await lookup(first)).slots.includes('13:00'));}finally{await db.execute('DELETE FROM appointment_time_slots WHERE id=?',[extraSlot.insertId]);}
  const created=await appointments.create(ids.patientUser,{dentalServiceId:`SVC-${suffix}`,doctorId:'DOC-CLINIC-NORA',date:first,time:'09:00'});
  assert.equal(created.doctorId,'DOC-CLINIC-NORA');assert.ok(!(await lookup(first)).slots.includes('09:00'));
  await assert.rejects(()=>appointments.adminCreate(ids.adminUser,{patientId:`PT-O-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:'DOC-CLINIC-NORA',date:first,time:'09:00',bookingSource:'Admin'}),/no longer available/i);
  await assert.rejects(()=>appointments.patientReschedule(ids.patientUser,created.id,{date:second,time:'09:00'}),/no longer available/i);
  await assert.rejects(()=>appointments.adminCreate(ids.adminUser,{patientId:`PT-O-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:'DOC-CLINIC-NORA',date:second,time:'09:00',bookingSource:'Admin'}),/no longer available/i);
  const adminCreated=await appointments.adminCreate(ids.adminUser,{patientId:`PT-O-${suffix}`,dentalServiceId:`SVC-${suffix}`,doctorId:'DOC-CLINIC-NORA',date:first,time:'10:00',bookingSource:'Admin'});assert.equal(adminCreated.doctorId,'DOC-CLINIC-NORA');
  await db.execute('INSERT INTO clinic_closed_dates(closed_date,reason) VALUES(?,?)',[nextMonth,`TEST-${suffix}`]);
  try{assert.deepEqual((await lookup(nextMonth)).slots,[]);}finally{await db.execute('DELETE FROM clinic_closed_dates WHERE closed_date=?',[nextMonth]);}
  assert.ok((await getAvailability(db,{doctorCode:'DOC-DEV-ROSNI',serviceCode:`SVC-${suffix}`,date:nextMonth})).slots.includes('09:00'));
  assert.ok((await getAvailability(db,{doctorCode:'DOC-DEV-DOCTOR-B',serviceCode:`SVC-${suffix}`,date:nextMonth})).slots.includes('09:00'));
});
test('same-day availability uses Kuala Lumpur server time and excludes elapsed slots',async()=>{let result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:monday,now:new Date(`${monday}T04:30:00.000Z`)});assert.ok(!result.slots.includes('09:00'));assert.ok(result.slots.includes('14:00'));result=await getAvailability(db,{doctorCode:`DOC-${suffix}`,serviceCode:`SVC-${suffix}`,date:monday,now:new Date(`${monday}T10:00:00.000Z`)});assert.deepEqual(result.slots,[]);});
test('appointment integration fixtures are removed',cleanup);
import './helpers/requireTestDatabase.js';
