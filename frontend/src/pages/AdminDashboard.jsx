import { useMemo, useState } from "react";
import { FaCalendarAlt, FaCheck, FaClock, FaMapMarkerAlt, FaPhoneAlt, FaTimes, FaUserFriends, FaUsers } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/admin/AdminLayout";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";
import "../styles/AdminDashboard.css";

const TODAY = APPOINTMENT_REFERENCE_DATE;
const clinicTimeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const clinicClosedDates = ["2026-08-31", "2026-09-16", "2026-10-03"];
const doctorBlockedSlots = [];

function toDateKey(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" });
}

function formatAvailabilityDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

function getAvailableSlots({ date, doctor, appointmentId, appointments }) {
  if (!date || date < TODAY || clinicClosedDates.includes(date)) return [];
  const day = new Date(`${date}T00:00:00`).getDay();
  if (day === 0) return [];

  const validClinicSlots = day === 6 ? clinicTimeSlots.filter((time) => time !== "5:00 PM") : clinicTimeSlots;
  return validClinicSlots.filter((time) => {
    const booked = appointments.some((item) =>
      item.id !== appointmentId && item.doctor === doctor && toDateKey(item.date) === date && item.time === time && ["Pending","Confirmed"].includes(item.status)
    );
    const blocked = doctorBlockedSlots.some((slot) => slot.doctor === doctor && slot.date === date && slot.time === time);
    return !booked && !blocked;
  });
}

function getEarliestAvailableDates({ doctor, appointmentId, appointments }) {
  const dates = [];
  const start = new Date(`${TODAY}T00:00:00`);
  for (let offset = 1; offset <= 45 && dates.length < 30; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    const date = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2,"0")}-${String(candidate.getDate()).padStart(2,"0")}`;
    const slots = getAvailableSlots({ date, doctor, appointmentId, appointments });
    if (slots.length) dates.push({ date, slots });
  }
  return dates;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { appointments: sharedAppointments, confirmAppointment, rescheduleAppointment, adminCancelAppointment } = useAppointments();
  const { patients:identityPatients, users } = useIdentity();
  const appointments = useMemo(() => sharedAppointments.filter((item) => item.date === TODAY).map((item) => ({ ...item, patient:identityPatients.find((patient)=>patient.patientId===item.patientId)?.fullName||item.patientName, treatment:item.service, doctor:item.doctorName, note:item.patientNote })), [sharedAppointments,identityPatients]);
  const patients = identityPatients.slice(0,3).map((patient)=>{const visits=sharedAppointments.filter((item)=>item.patientId===patient.patientId).sort((a,b)=>b.date.localeCompare(a.date));const next=visits.filter((item)=>item.date>=TODAY&&!['Completed','Cancelled'].includes(item.status)).sort((a,b)=>a.date.localeCompare(b.date))[0];return{id:patient.patientId,name:patient.fullName,age:patient.age,phone:patient.phone,lastVisit:visits.find((item)=>item.date<TODAY||item.status==='Completed')?.date||"No previous visit",upcoming:next?`${next.date}, ${next.time}`:"Not scheduled"};});
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [feedback, setFeedback] = useState("");

  function updateStatus(appointment, status) {
    if (status === "Cancelled") adminCancelAppointment(appointment.id, { reason:"Cancelled by clinic administration" });
    else if (status === "Confirmed") confirmAppointment(appointment.id);
    setSelectedAppointment((current) => current?.id === appointment.id ? { ...current, status } : current);
    setFeedback(`${appointment.patient}'s appointment is now ${status.toLowerCase()}.`);
  }

  function saveReschedule(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const dateKey = data.get("date");
    const time = data.get("time");
    const reason = data.get("reason").trim();
    const availableSlots = getAvailableSlots({ date:dateKey, doctor:rescheduling.doctor, appointmentId:rescheduling.id, appointments });
    if (!dateKey || !time || !availableSlots.includes(time)) {
      setFeedback("That appointment slot is no longer available. Please select another time.");
      return;
    }
    rescheduleAppointment(rescheduling.id, { date:dateKey, time, reason });
    setFeedback(`${rescheduling.patient}'s appointment was rescheduled.`);
    setRescheduling(null);
    setSelectedAppointment(null);
  }

  return (
    <AdminLayout activePage="overview" pageTitle="Overview" pageSubtitle="Admin Portal · Klinik Pergigian Rosni Adam">
      {feedback && <div className="admin-feedback" role="status"><FaCheck /> {feedback}<button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message"><FaTimes /></button></div>}
      <section className="admin-welcome"><div><span>Clinic Administration</span><h2>Welcome back, Admin</h2><p>Manage today&apos;s appointments, patients, and clinic operations from one place.</p></div><div className="admin-welcome-date"><FaCalendarAlt /><p><strong>Sunday, 9 August 2026</strong><span>Clinic administration overview</span></p></div></section>
      <section className="admin-stat-grid" aria-label="Clinic summary">
        <article><div className="teal"><FaUserFriends /></div><p><strong>248</strong><span>Total Patients</span><small>12 new this month</small></p></article>
        <article><div className="blue"><FaCalendarAlt /></div><p><strong>{appointments.length}</strong><span>Today&apos;s Appointments</span><small>Full daily schedule</small></p></article>
        <article><div className="orange"><FaClock /></div><p><strong>{appointments.filter((item) => item.status === "Pending").length}</strong><span>Pending Appointments</span><small>Awaiting confirmation</small></p></article>
        <article><div className="purple"><FaUsers /></div><p><strong>{users.length}</strong><span>Total Users</span><small>Patients, doctor and admin</small></p></article>
      </section>
      <section className="admin-dashboard-grid">
        <div className="admin-main-column">
          <article className="admin-card"><header><div><span>Daily Operations</span><h3>Today&apos;s Appointments</h3></div></header><div className="admin-appointment-list">
            {appointments.map((appointment) => <div className="admin-appointment-row" key={appointment.id}><div><strong>{appointment.patient}</strong><span>{appointment.patientId}</span></div><div><strong>{appointment.treatment}</strong><span>{appointment.doctor}</span></div><div><strong>{appointment.time}</strong><span>{appointment.date}</span></div><span className={`admin-status ${appointment.status.toLowerCase()}`}>{appointment.status}</span><div className="admin-row-actions"><button type="button" onClick={() => setSelectedAppointment(appointment)}>View Details</button>{appointment.status === "Pending" && <button type="button" onClick={() => updateStatus(appointment, "Confirmed")}>Confirm</button>}{["Pending","Confirmed"].includes(appointment.status) && <><button type="button" onClick={() => setRescheduling(appointment)}>Reschedule</button><button type="button" className="danger" onClick={() => updateStatus(appointment, "Cancelled")}>Cancel</button></>}</div></div>)}
          </div></article>
          <article className="admin-card"><header><div><span>Patient Activity</span><h3>Recent Patients</h3></div></header><div className="admin-patient-list">{patients.map((patient) => <div className="admin-patient-row" key={patient.id}><div className="admin-patient-avatar">{patient.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><div><strong>{patient.name}</strong><span>{patient.id}</span></div><div><small>Last Visit</small><strong>{patient.lastVisit}</strong></div><div><small>Upcoming Appointment</small><strong>{patient.upcoming}</strong></div><button type="button" onClick={() => navigate("/admin-patient-records", { state: { patientId: patient.id } })}>View Patient Record</button></div>)}</div></article>
        </div>
        <aside className="admin-side-column">
          <article className="admin-card"><header><div><span>Attention Required</span><h3>Pending Actions</h3></div></header><div className="admin-pending-list"><div><span className="orange">1</span><p><strong>Appointments awaiting confirmation</strong><small>Review today&apos;s pending requests</small></p></div><div><span className="teal">4</span><p><strong>Follow-up patients</strong><small>Due for administrative follow-up</small></p></div><div><span className="blue">3</span><p><strong>Recently registered patients</strong><small>Profiles added this week</small></p></div></div></article>
          <article className="admin-card"><header><div><span>Clinic Details</span><h3>Clinic Information</h3></div></header><div className="admin-clinic-info"><div><FaMapMarkerAlt /><p><strong>Klinik Pergigian Rosni Adam</strong><span>Bandar Sri Permaisuri, Kuala Lumpur</span></p></div><div><FaClock /><p><strong>Opening Hours</strong><span>Monâ€“Fri, 9:00 AMâ€“6:00 PM<br />Saturday, 9:00 AMâ€“5:00 PM</span></p></div><div><FaPhoneAlt /><p><strong>Clinic Phone</strong><span>03-9171 2817</span></p></div></div></article>
        </aside>
      </section>
      {selectedAppointment && <AppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onConfirm={() => updateStatus(selectedAppointment, "Confirmed")} onReschedule={() => setRescheduling(selectedAppointment)} onCancel={() => updateStatus(selectedAppointment, "Cancelled")} />}
      {rescheduling && <RescheduleModal appointment={rescheduling} appointments={appointments} onClose={() => setRescheduling(null)} onSave={saveReschedule} />}
    </AdminLayout>
  );
}

function ModalShell({ title, eyebrow, onClose, children, footer }) { return <div className="admin-modal-overlay" onMouseDown={onClose}><section className="admin-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><FaCalendarAlt /></div><span><small>{eyebrow}</small><h2>{title}</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes /></button></header>{children}<footer>{footer}</footer></section></div>; }
function AppointmentModal({ appointment, onClose, onConfirm, onReschedule, onCancel }) { return <ModalShell title="Appointment Details" eyebrow="Clinic Schedule" onClose={onClose} footer={<><button type="button" onClick={onClose}>Close</button>{appointment.status === "Pending" && <button type="button" className="primary" onClick={onConfirm}>Confirm</button>}{["Pending","Confirmed"].includes(appointment.status) && <><button type="button" onClick={onReschedule}>Reschedule</button><button type="button" className="danger" onClick={onCancel}>Cancel</button></>}</>}><div className="admin-modal-grid">{[["Patient", appointment.patient],["Patient ID",appointment.patientId],["Appointment ID",appointment.id],["Treatment",appointment.treatment],["Doctor",appointment.doctor],["Date & Time",`${appointment.date}, ${appointment.time}`],["Status",appointment.status],["Patient Note",appointment.note]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></ModalShell>; }
function RescheduleModal({ appointment, appointments, onClose, onSave }) {
  const [mode,setMode]=useState("earliest");
  const [date,setDate]=useState("");
  const [time,setTime]=useState("");
  const [visibleCount,setVisibleCount]=useState(3);
  const earliestDates=useMemo(()=>getEarliestAvailableDates({doctor:appointment.doctor,appointmentId:appointment.id,appointments}),[appointment.doctor,appointment.id,appointments]);
  const selectedDateSlots=getAvailableSlots({date,doctor:appointment.doctor,appointmentId:appointment.id,appointments});
  const isClosed=date&&(new Date(`${date}T00:00:00`).getDay()===0||clinicClosedDates.includes(date));
  function changeMode(nextMode){setMode(nextMode);setDate("");setTime("");}
  function chooseSlot(nextDate,nextTime){setDate(nextDate);setTime(nextTime);}

  return <ModalShell title="Reschedule Appointment" eyebrow={appointment.patient} onClose={onClose} footer={null}>
    <div className="admin-dashboard-reschedule-summary">
      <div><span>Patient</span><strong>{appointment.patient}</strong><small>{appointment.patientId}</small></div>
      <div><span>Treatment</span><strong>{appointment.treatment}</strong></div>
      <div><span>Doctor</span><strong>{appointment.doctor}</strong></div>
      <div><span>Current Appointment</span><strong>{appointment.date}</strong><small>{appointment.time}</small></div>
    </div>
    <form className="admin-dashboard-slot-form" onSubmit={onSave}>
      <section className="admin-dashboard-slot-finder">
        <header><strong>Find Available Slot</strong><span>Only free appointment times are shown.</span></header>
        <div className="admin-dashboard-slot-tabs" role="tablist" aria-label="Availability search mode">
          <button type="button" role="tab" aria-selected={mode==="earliest"} className={mode==="earliest"?"active":""} onClick={()=>changeMode("earliest")}>Earliest Available</button>
          <button type="button" role="tab" aria-selected={mode==="date"} className={mode==="date"?"active":""} onClick={()=>changeMode("date")}>Choose Date</button>
        </div>
        {mode==="earliest"&&<div className="admin-dashboard-earliest-dates">
          {earliestDates.slice(0,visibleCount).map((group)=><article className={date===group.date?"selected-date":""} key={group.date}><h3>{formatAvailabilityDate(group.date)}</h3><div>{group.slots.map((slot)=><button type="button" key={slot} className={date===group.date&&time===slot?"selected":""} aria-pressed={date===group.date&&time===slot} onClick={()=>chooseSlot(group.date,slot)}>{slot}</button>)}</div></article>)}
          {visibleCount<earliestDates.length&&<button type="button" className="show-more" onClick={()=>setVisibleCount((count)=>Math.min(count+3,earliestDates.length))}>Show More Dates</button>}
        </div>}
        {mode==="date"&&<div className="admin-dashboard-date-choice">
          <label><span>Choose Date</span><input type="date" min={TODAY} value={date} onChange={(event)=>{setDate(event.target.value);setTime("");}} /></label>
          {date&&<h3>{formatAvailabilityDate(date)}</h3>}
          {date&&selectedDateSlots.length>0&&<div>{selectedDateSlots.map((slot)=><button type="button" key={slot} className={time===slot?"selected":""} aria-pressed={time===slot} onClick={()=>setTime(slot)}>{slot}</button>)}</div>}
          {date&&selectedDateSlots.length===0&&<p className="unavailable">{isClosed?"The clinic is closed on this date.":"No available appointment slots for this date."}</p>}
          {!date&&<p>Select a date to view available appointment slots.</p>}
        </div>}
      </section>
      {date&&time&&<div className="admin-dashboard-selected-slot" role="status"><span>Selected</span><strong>{formatDate(date)} <b>â€¢</b> {time}</strong></div>}
      <input type="hidden" name="date" value={date}/><input type="hidden" name="time" value={time}/>
      <label className="admin-dashboard-reason"><span>Admin Note / Reschedule Reason <small>(Optional)</small></span><textarea name="reason" rows="3" placeholder="Patient requested another appointment date." /></label>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={!date||!time}>Confirm Reschedule</button></footer>
    </form>
  </ModalShell>;
}

export default AdminDashboard;


