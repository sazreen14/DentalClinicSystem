import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaUser,
  FaTimes,
  FaChevronRight,
  FaCheckCircle,
} from "react-icons/fa";

import PatientLayout from "../components/patient/PatientLayout";
import AppointmentModal from "../components/modals/AppointmentModal";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { sameDayAvailabilityAdjustment } from "../utils/appointmentDateAvailability";

import "../styles/PatientAppointments.css";

function PatientAppointments() {
  const { appointments: sharedAppointments, loading, error, cancelAppointment, patientRescheduleAppointment, getAvailability } = useAppointments();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab === "completed" ? "completed" : "upcoming");
  const [showAppointmentModal, setShowAppointmentModal] =
    useState(false);

  const appointments = sharedAppointments.map((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    return { ...item, doctor:item.doctorName, location:"Klinik Pergigian Rosni Adam", dateKey:item.date, date:date.toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }), day:String(date.getDate()).padStart(2,"0"), month:date.toLocaleDateString("en-MY", { month:"short" }) };
  });
  const [selectedAppointment, setSelectedAppointment] =
    useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [feedback, setFeedback] = useState("");

  const activeAppointments = appointments.filter(
    (appointment) => appointment.dateKey >= APPOINTMENT_REFERENCE_DATE && !["Cancelled", "Completed"].includes(appointment.status)
  );
  const statusFilters = ["Pending", "Confirmed", "Completed", "Cancelled"];
  const statusCounts = Object.fromEntries(statusFilters.map((status) => [status, appointments.filter((appointment) => appointment.status === status).length]));
  const filters = [{ id:"upcoming", label:"Upcoming", count:activeAppointments.length }, ...statusFilters.map((status) => ({ id:status.toLowerCase(), label:status, count:statusCounts[status] }))];
  const visibleAppointments = activeTab === "upcoming"
    ? activeAppointments
    : appointments.filter((appointment) => appointment.status.toLowerCase() === activeTab);

  async function handleCancelAppointment(appointmentId) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) {
      return;
    }

    const reason = window.prompt(
      "Please enter a cancellation reason:"
    );

    if (!reason?.trim()) return;

    await cancelAppointment(appointmentId, { reason:reason.trim() });
    setSelectedAppointment((appointment) =>
      appointment?.id === appointmentId
        ? { ...appointment, status:"Cancelled", cancellationReason:reason.trim() }
        : appointment
    );
    setActiveTab("history");
  }

  return (
    <PatientLayout
      activePage="appointments"
      pageTitle="Appointments"
    >
      {loading && <p role="status">Loading appointments…</p>}
      {!loading && error && <p role="alert">Appointments could not be loaded: {error}</p>}
      {feedback && <p className="figma-appointments-feedback" role="status">{feedback}</p>}
      <section className="figma-appointments-heading">
        <div>
          <span>Appointment Management</span>
          <h2>My Appointments</h2>

          <p>
            View your upcoming appointments and previous dental
            visits.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAppointmentModal(true)}
        >
          <FaCalendarAlt />
          Book New Appointment
        </button>
      </section>

      <section className="figma-appointments-summary" aria-label="Appointment status summary">
        {statusFilters.map((status) => (
          <article className={`figma-appointments-summary-card ${status.toLowerCase()}`} key={status}>
            <span>{status}</span>
            <strong>{statusCounts[status]}</strong>
            <small>{statusCounts[status] === 1 ? "appointment" : "appointments"}</small>
          </article>
        ))}
      </section>

      <div className="figma-appointments-tabs" role="group" aria-label="Filter appointments">
        {filters.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={activeTab === filter.id ? "active" : ""}
            aria-pressed={activeTab === filter.id}
            onClick={() => setActiveTab(filter.id)}
          >
            {filter.label}<span>{filter.count}</span>
          </button>
        ))}
      </div>

      <section className="figma-appointments-section">
        <div className="figma-section-heading">
          <div>
            <span>Appointment List</span>
            <h3>{filters.find((filter) => filter.id === activeTab)?.label} Appointments</h3>
          </div>
          <p>{visibleAppointments.length} {visibleAppointments.length === 1 ? "appointment" : "appointments"}</p>
        </div>

        <div className="figma-upcoming-list">
          {visibleAppointments.length > 0 ? visibleAppointments.map((appointment) => {
            const canManage = activeAppointments.some((active) => active.id === appointment.id);
            return (
              <article className="figma-appointment-card" key={appointment.id}>
                <div className="figma-appointment-date">
                  <span>{appointment.month}</span>
                  <strong>{appointment.day}</strong>
                </div>
                <div className="figma-appointment-info">
                  <span>Dental Service</span>
                  <h3>{appointment.service}</h3>
                  <div className="figma-appointment-meta">
                    <span><FaUser />{appointment.doctor}</span>
                    <span><FaCalendarAlt />{appointment.date}</span>
                    <span><FaClock />{appointment.time}</span>
                    <span><FaMapMarkerAlt />{appointment.location}</span>
                  </div>
                </div>
                <div className="figma-appointment-actions">
                  <span className={`figma-appointment-status ${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                  <button type="button" className="figma-details-button" onClick={() => setSelectedAppointment(appointment)}>
                    View Details <FaChevronRight />
                  </button>
                  {canManage && (
                    <>
                      <button type="button" className="figma-details-button" onClick={() => setRescheduling(appointment)}>
                        <FaCalendarAlt /> Reschedule
                      </button>
                      <button type="button" className="figma-cancel-button" onClick={() => handleCancelAppointment(appointment.id)}>
                        <FaTimes /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          }) : (
            <div className="figma-appointments-empty">
              <FaCalendarAlt />
              <h3>No {activeTab === "upcoming" ? "upcoming" : activeTab} appointments</h3>
              <p>{activeTab === "upcoming" ? "You currently have no scheduled dental appointments." : `You have no ${activeTab} appointments to display.`}</p>
              {activeTab === "upcoming" && <button type="button" onClick={() => setShowAppointmentModal(true)}>Book Appointment</button>}
            </div>
          )}
        </div>
      </section>

      {showAppointmentModal && (
        <AppointmentModal
          onClose={() =>
            setShowAppointmentModal(false)
          }
        />
      )}

      {selectedAppointment && (
        <div className="figma-appointment-details-overlay" role="presentation" onMouseDown={() => setSelectedAppointment(null)}>
          <section className="figma-appointment-details-modal" role="dialog" aria-modal="true" aria-labelledby="patient-appointment-details-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>Appointment Details</span><h3 id="patient-appointment-details-title">{selectedAppointment.service}</h3></div>
              <button type="button" aria-label="Close appointment details" onClick={() => setSelectedAppointment(null)}><FaTimes /></button>
            </header>
            <div className="figma-appointment-details-grid">
              <div><div className="figma-appointment-detail-icon date"><FaCalendarAlt /></div><div className="figma-appointment-detail-copy"><span>Date</span><strong>{selectedAppointment.date}</strong></div></div>
              <div><div className="figma-appointment-detail-icon time"><FaClock /></div><div className="figma-appointment-detail-copy"><span>Time</span><strong>{selectedAppointment.time}</strong></div></div>
              <div><div className="figma-appointment-detail-icon doctor"><FaUser /></div><div className="figma-appointment-detail-copy"><span>Doctor</span><strong>{selectedAppointment.doctor}</strong></div></div>
              <div><div className="figma-appointment-detail-icon status"><FaShieldAlt /></div><div className="figma-appointment-detail-copy"><span>Status</span><strong className={`figma-appointment-detail-status ${selectedAppointment.status.toLowerCase()}`}>{["Confirmed","Completed"].includes(selectedAppointment.status)?<FaCheckCircle />:selectedAppointment.status==="Cancelled"?<FaTimes />:<FaClock />}{selectedAppointment.status}</strong></div></div>
              <div className="wide"><div className="figma-appointment-detail-icon clinic"><FaMapMarkerAlt /></div><div className="figma-appointment-detail-copy"><span>Clinic</span><strong>{selectedAppointment.location || "Klinik Pergigian Rosni Adam"}</strong></div></div>
              {selectedAppointment.cancellationReason && <div className="wide reason"><span>Cancellation reason</span><strong>{selectedAppointment.cancellationReason}</strong></div>}
            </div>
            <footer><button type="button" onClick={() => setSelectedAppointment(null)}>Close</button></footer>
          </section>
        </div>
      )}
      {rescheduling && <PatientRescheduleModal appointment={rescheduling} getAvailability={getAvailability} onClose={() => setRescheduling(null)} onSave={async values => {const updated=await patientRescheduleAppointment(rescheduling.id,values);setRescheduling(null);setFeedback(`${updated.service} was rescheduled and is pending staff confirmation.`);}} />}
    </PatientLayout>
  );
}

function PatientRescheduleModal({appointment,getAvailability,onClose,onSave}) {
  const [date,setDate]=useState("");const [minimumDate,setMinimumDate]=useState(APPOINTMENT_REFERENCE_DATE);const [slots,setSlots]=useState([]);const [time,setTime]=useState("");const [reason,setReason]=useState("");const [busy,setBusy]=useState(false);const [loadingSlots,setLoadingSlots]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{const close=event=>{if(event.key==='Escape'&&!busy)onClose();};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[busy,onClose]);
  useEffect(()=>{let current=true;queueMicrotask(()=>{if(!current)return;setTime('');setSlots([]);if(!date)return;setError('');setLoadingSlots(true);getAvailability({doctorId:appointment.doctorId,serviceId:appointment.dentalServiceId,date}).then(value=>{if(!current)return;const next=value.slots||[],adjustment=sameDayAvailabilityAdjustment(date,value,minimumDate);setSlots(next);if(adjustment.clearSelectedDate){setMinimumDate(adjustment.minimumDate);setDate('');setError(adjustment.message);}}).catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoadingSlots(false);});});return()=>{current=false;};},[date,appointment.doctorId,appointment.dentalServiceId,getAvailability,minimumDate]);
  async function submit(event){event.preventDefault();if(!time||busy)return;setBusy(true);setError('');try{const latest=await getAvailability({doctorId:appointment.doctorId,serviceId:appointment.dentalServiceId,date});if(!latest.slots?.includes(time))throw new Error('That appointment time is no longer available. Please select another time.');await onSave({date,time,reason});}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="figma-appointment-details-overlay" role="presentation" onMouseDown={()=>{if(!busy)onClose();}}><section className="figma-appointment-details-modal figma-reschedule-modal" role="dialog" aria-modal="true" aria-labelledby="patient-reschedule-title" onMouseDown={event=>event.stopPropagation()}><header><div><span>Appointment Rescheduling</span><h3 id="patient-reschedule-title">Choose a new appointment time</h3></div><button type="button" aria-label="Close rescheduling" disabled={busy} onClick={onClose}><FaTimes /></button></header><form onSubmit={submit}><div className="figma-reschedule-summary"><span>Service</span><strong>{appointment.service}</strong><span>Doctor</span><strong>{appointment.doctorName||appointment.doctor}</strong><span>Duration</span><strong>{appointment.durationMinutes} minutes</strong></div><label><span>New date</span><input autoFocus required type="date" min={minimumDate} value={date} onChange={event=>setDate(event.target.value)} /></label><label><span>Available time</span><select required disabled={!date||loadingSlots} value={time} onChange={event=>setTime(event.target.value)}><option value="">{loadingSlots?'Loading available times…':'Select a time'}</option>{slots.map(slot=><option key={slot} value={slot}>{slot}</option>)}</select></label><label><span>Reason (optional)</span><textarea maxLength="1000" rows="3" value={reason} onChange={event=>setReason(event.target.value)} /></label>{date&&!loadingSlots&&!slots.length&&!error&&<p role="status">No times are available on this date.</p>}{error&&<p role="alert">{error}</p>}<small>After rescheduling, this appointment will be pending staff confirmation.</small><footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" disabled={busy||!time}>{busy?'Rescheduling…':'Confirm Reschedule'}</button></footer></form></section></div>;
}

export default PatientAppointments;
