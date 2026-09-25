import { AppError } from "../utils/AppError.js";
import { findDoctor, findService } from "../models/appointmentModel.js";
import { env } from "../config/env.js";

const activeStatuses = ['Pending','Confirmed'];
const minutes = (time) => { const [h,m]=time.slice(0,5).split(':').map(Number); return h*60+m; };
export const intervalsOverlap=(aStart,aDuration,bStart,bDuration)=>aStart<bStart+bDuration&&bStart<aStart+aDuration;
const weekday=(date)=>new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
export function clinicClock(now=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};}
export function isPastDate(date,now=new Date()){ return date < clinicClock(now).date; }

export async function getAvailability(db,{doctorCode,serviceCode,date,excludeAppointmentId=null,lock=false,allowedDoctorIds=env.bookingDoctorIds,now=new Date()}){
  const current=clinicClock(now);if(isPastDate(date,now)) throw new AppError('Appointment date must not be in the past.',422,'INVALID_APPOINTMENT_DATE');
  const doctor=await findDoctor(db,doctorCode,allowedDoctorIds), service=await findService(db,serviceCode);
  if(!doctor) throw new AppError('The selected doctor is unavailable.',404,'DOCTOR_UNAVAILABLE');
  if(!service) throw new AppError('The selected dental service is unavailable.',404,'SERVICE_UNAVAILABLE');
  const day=weekday(date);
  const [clinicRows]=await db.execute("SELECT * FROM clinic_operating_hours WHERE day_of_week=? LIMIT 1",[day]);
  const clinic=clinicRows[0];
  const [closed]=await db.execute("SELECT id FROM clinic_closed_dates WHERE closed_date=? LIMIT 1",[date]);
  if(!clinic?.is_open||closed.length) return {doctor,service,slots:[]};
  const [workingRows]=await db.execute("SELECT * FROM doctor_working_hours WHERE doctor_id=? AND day_of_week=? LIMIT 1",[doctor.id,day]);
  const working=workingRows[0];
  const [monthlyRules]=await db.execute('SELECT week_of_month,day_of_week,is_enabled FROM doctor_monthly_availability WHERE doctor_id=?',[doctor.id]);
  const monthlyDateMatches=monthlyRules.some(rule=>rule.is_enabled&&rule.day_of_week===day&&Number(rule.week_of_month)===Math.ceil(Number(date.slice(8,10))/7));
  if(monthlyRules.length ? !monthlyDateMatches : working&&!working.is_working) return {doctor,service,slots:[]};
  const weeklyHours=monthlyRules.length?null:working;
  const open=Math.max(minutes(clinic.opening_time),weeklyHours?minutes(weeklyHours.start_time):0);
  const close=Math.min(minutes(clinic.closing_time),weeklyHours?minutes(weeklyHours.end_time):1440);
  const [slotRows]=await db.execute("SELECT doctor_id,slot_time,is_enabled FROM appointment_time_slots WHERE doctor_id IS NULL OR doctor_id=? ORDER BY slot_time,doctor_id DESC",[doctor.id]);
  const [blocked]=await db.execute("SELECT start_time,end_time FROM doctor_blocked_times WHERE doctor_id=? AND blocked_date=?",[doctor.id,date]);
  const [breaks]=await db.execute("SELECT start_time,end_time FROM clinic_recurring_breaks WHERE day_of_week=? AND is_enabled=TRUE",[day]);
  const suffix=lock?' FOR UPDATE':'';
  const [booked]=await db.execute(`SELECT a.id,a.appointment_time,ds.duration_minutes FROM appointments a JOIN dental_services ds ON ds.id=a.dental_service_id WHERE a.doctor_id=? AND a.appointment_date=? AND a.status IN ('Pending','Confirmed')${suffix}`,[doctor.id,date]);
  const duration=Number(service.duration_minutes);
  const scopedSlots=new Map();for(const row of slotRows){const key=row.slot_time.slice(0,5);if(!scopedSlots.has(key)||row.doctor_id)scopedSlots.set(key,Boolean(row.is_enabled));}
  const slots=[...scopedSlots.entries()].filter(([,enabled])=>enabled).map(([value])=>value).filter(t=>{
    const start=minutes(t); if(start<open||start+duration>close||date===current.date&&start<=current.minutes) return false;
    if(blocked.some(x=>intervalsOverlap(start,duration,minutes(x.start_time),minutes(x.end_time)-minutes(x.start_time)))) return false;
    if(breaks.some(x=>intervalsOverlap(start,duration,minutes(x.start_time),minutes(x.end_time)-minutes(x.start_time)))) return false;
    return !booked.some(x=>x.id!==excludeAppointmentId&&activeStatuses.includes(x.status??'Pending')&&intervalsOverlap(start,duration,minutes(x.appointment_time),Number(x.duration_minutes)));
  });
  return {doctor,service,slots};
}

export async function assertAvailable(db,input){ const result=await getAvailability(db,{...input,lock:true}); if(!result.slots.includes(input.time.slice(0,5))) throw new AppError('The selected appointment slot is no longer available.',409,'APPOINTMENT_SLOT_UNAVAILABLE'); return result; }
