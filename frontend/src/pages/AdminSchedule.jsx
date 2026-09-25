import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaFilter, FaTimes } from "react-icons/fa";
import AdminLayout from "../components/admin/AdminLayout";
import { getLocalDateKey, useAppointments } from "../context/useAppointments";
import "../styles/AdminSchedule.css";

const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const timeSlots = Array.from({length:18},(_,index)=>`${String(9+Math.floor(index/2)).padStart(2,"0")}:${index%2?"30":"00"}`).filter((time)=>time<="17:30");
const dateKey = (date) => getLocalDateKey(date);
const displayTime = (value) => new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-MY",{hour:"numeric",minute:"2-digit"});
const displayDate = (value, options={day:"numeric",month:"short"}) => new Date(`${value}T00:00:00`).toLocaleDateString("en-MY",options);

function mondayFor(offset) {
  const current = new Date();
  current.setHours(0,0,0,0);
  const day = current.getDay();
  current.setDate(current.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return current;
}

export default function AdminSchedule() {
  const navigate = useNavigate();
  const { appointments, loading, error } = useAppointments();
  const [weekOffset,setWeekOffset] = useState(0);
  const [doctorId,setDoctorId] = useState("all");
  const [selected,setSelected] = useState(null);
  const days = useMemo(()=>{const monday=mondayFor(weekOffset);return dayNames.map((name,index)=>{const date=new Date(monday);date.setDate(monday.getDate()+index);return{name,date:dateKey(date)};});},[weekOffset]);
  const doctors = useMemo(()=>Array.from(new Map(appointments.map((item)=>[item.doctorId,{id:item.doctorId,name:item.doctorName}])).values()).sort((a,b)=>a.name.localeCompare(b.name)),[appointments]);
  const visible = useMemo(()=>appointments.filter((item)=>item.status!=="Cancelled"&&days.some((day)=>day.date===item.date)&&(doctorId==="all"||item.doctorId===doctorId)),[appointments,days,doctorId]);
  const range = `${displayDate(days[0].date)} – ${displayDate(days[5].date,{day:"numeric",month:"short",year:"numeric"})}`;
  const openAction = (action) => navigate("/admin-appointments",{state:{appointmentId:selected.id,action}});

  return <AdminLayout activePage="schedule" pageTitle="Schedule" pageSubtitle="Clinic-wide appointment calendar and Doctor schedules.">
    <section className="admin-schedule-heading"><div><span>Clinic Calendar</span><h2>Schedule</h2><p>Review appointments across all legitimate clinic Doctors.</p></div><div><FaCalendarAlt /></div></section>
    <section className="admin-schedule-controls"><div><button type="button" onClick={()=>setWeekOffset(0)}>Today</button><button type="button" onClick={()=>setWeekOffset((value)=>value-1)} aria-label="Previous week"><FaChevronLeft /></button><strong>{range}</strong><button type="button" onClick={()=>setWeekOffset((value)=>value+1)} aria-label="Next week"><FaChevronRight /></button></div><label><FaFilter /><span>Doctor</span><select value={doctorId} onChange={(event)=>setDoctorId(event.target.value)}><option value="all">All Doctors</option>{doctors.map((doctor)=><option value={doctor.id} key={doctor.id}>{doctor.name}</option>)}</select></label></section>
    {loading&&<p role="status">Loading clinic schedule…</p>}{!loading&&error&&<p role="alert">Schedule could not be loaded: {error}</p>}
    {!loading&&!error&&<section className="admin-schedule-card"><header><div><span>Weekly Overview</span><h3>{doctorId==="all"?"All Doctor Appointments":doctors.find((doctor)=>doctor.id===doctorId)?.name}</h3></div><p>{visible.length} active appointments</p></header><div className="admin-schedule-scroll"><div className="admin-schedule-grid"><div className="corner">Time</div>{days.map((day)=><div className="day" key={day.date}><strong>{day.name}</strong><span>{displayDate(day.date)}</span></div>)}{timeSlots.map((time)=><div className="row" key={time}><div className="time">{displayTime(time)}</div>{days.map((day)=>{const entries=visible.filter((item)=>item.date===day.date&&item.time===time);return <div className="slot" key={`${day.date}-${time}`}>{entries.map((appointment)=><button type="button" className={`appointment ${appointment.status.toLowerCase()}`} onClick={()=>setSelected(appointment)} key={appointment.id}><strong>{appointment.patientName}</strong><span>{appointment.service}</span><small>{appointment.doctorName} · {appointment.status}</small></button>)}</div>;})}</div>)}</div></div></section>}
    {selected&&<div className="admin-schedule-modal-overlay" onMouseDown={()=>setSelected(null)}><section className="admin-schedule-modal" role="dialog" aria-modal="true" onMouseDown={(event)=>event.stopPropagation()}><header><div><FaCalendarAlt /></div><span><small>Appointment Details</small><h2>{selected.patientName}</h2></span><button type="button" onClick={()=>setSelected(null)} aria-label="Close"><FaTimes /></button></header><div className="admin-schedule-modal-grid">{[["Patient ID",selected.patientId],["Doctor",selected.doctorName],["Service",selected.service],["Date",displayDate(selected.date,{day:"numeric",month:"long",year:"numeric"})],["Time",displayTime(selected.time)],["Status",selected.status]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><footer><button type="button" onClick={()=>setSelected(null)}>Close</button><button type="button" onClick={()=>openAction("details")}>View Details</button>{["Pending","Confirmed"].includes(selected.status)&&<><button type="button" onClick={()=>openAction("reschedule")}>Reschedule</button><button type="button" className="danger" onClick={()=>openAction("cancel")}>Cancel</button></>}</footer></section></div>}
  </AdminLayout>;
}
