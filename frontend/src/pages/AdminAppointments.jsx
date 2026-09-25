import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaCheck, FaClock, FaPlus, FaSearch, FaStickyNote, FaTimes, FaUserCheck, FaUserClock } from "react-icons/fa";
import AdminLayout from "../components/admin/AdminLayout";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";
import "../styles/AdminAppointments.css";

const TODAY = APPOINTMENT_REFERENCE_DATE;
const clinicTimeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const clinicClosedDates = ["2026-08-31", "2026-09-16", "2026-10-03"];
const doctorBlockedSlots = [];
const filters = [
  { id:"today", label:"Today" }, { id:"upcoming", label:"Upcoming" }, { id:"pending", label:"Pending" }, { id:"completed", label:"Completed" }, { id:"cancelled", label:"Cancelled" },
];

function formatDate(date) { return new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }); }
function matchesFilter(item, filter) {
  if (filter === "today") return item.date === TODAY;
  if (filter === "upcoming") return item.date > TODAY && !["Completed","Cancelled"].includes(item.status);
  return item.status.toLowerCase() === filter;
}

function normalizeSearchValue(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

function matchesSearch(appointment, searchTerm) {
  const queryTokens = normalizeSearchValue(searchTerm).split(" ").filter(Boolean);
  if (!queryTokens.length) return true;
  const searchableText = normalizeSearchValue([
    appointment.patient,
    appointment.patientId,
    appointment.treatment,
    appointment.doctor,
  ].join(" "));
  return queryTokens.every((token) => searchableText.includes(token));
}

function getAvailableSlots({ date, doctor, appointmentId, appointments }) {
  if (!date || date < TODAY || clinicClosedDates.includes(date)) return [];

  const day = new Date(`${date}T00:00:00`).getDay();
  if (day === 0) return [];

  const closingTime = day === 6 ? "5:00 PM" : "6:00 PM";
  const validClinicSlots = clinicTimeSlots.filter((time) =>
    closingTime === "5:00 PM" ? time !== "5:00 PM" : true
  );

  return validClinicSlots.filter((time) => {
    const hasAppointmentConflict = appointments.some((item) =>
      item.id !== appointmentId &&
      item.doctor === doctor &&
      item.date === date &&
      item.time === time &&
      ["Pending", "Confirmed"].includes(item.status)
    );
    const isBlocked = doctorBlockedSlots.some((slot) =>
      slot.doctor === doctor && slot.date === date && slot.time === time
    );

    return !hasAppointmentConflict && !isBlocked;
  });
}

function getEarliestAvailableDates({ doctor, appointmentId, appointments, limit = 30 }) {
  const dates = [];
  const cursor = new Date(`${TODAY}T00:00:00`);

  for (let offset = 1; offset <= 45 && dates.length < limit; offset += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + offset);
    const date = candidate.toLocaleDateString("en-CA");
    const slots = getAvailableSlots({ date, doctor, appointmentId, appointments });

    if (slots.length) dates.push({ date, slots });
  }

  return dates;
}

function formatAvailabilityDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  });
}

function AdminAppointments() {
  const location = useLocation();
  const navigate = useNavigate();
  const { appointments: sharedAppointments, loading, error, confirmAppointment: confirmSharedAppointment, rescheduleAppointment, adminCancelAppointment, adminAddAppointment, adminAddAppointmentForNewPatient, getAdminBookingOptions, getAvailability } = useAppointments();
  const { patients, reloadIdentity } = useIdentity();
  const appointments = useMemo(() => sharedAppointments.map((item) => ({ ...item, patient:patients.find((patient)=>patient.patientId===item.patientId)?.fullName||item.patientName, treatment:item.service, doctor:item.doctorName, note:item.patientNote })), [sharedAppointments,patients]);
  const [activeFilter, setActiveFilter] = useState("today");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const appointmentId = location.state?.appointmentId;
    const action = location.state?.action;
    if (!appointmentId || !action || !appointments.length) return;
    queueMicrotask(() => {
      const appointment = appointments.find((item) => item.id === appointmentId);
      if (appointment && ["details","reschedule","cancel"].includes(action)) setModal({ type:action, appointment });
      navigate(location.pathname, { replace:true, state:null });
    });
  }, [appointments, location.pathname, location.state, navigate]);

  const counts = useMemo(() => {
    return Object.fromEntries(filters.map((filter) => [filter.id, appointments.filter((item) => matchesFilter(item, filter.id) && matchesSearch(item, search)).length]));
  }, [appointments, search]);
  const visibleAppointments = useMemo(() => {
    const isSearching = normalizeSearchValue(search).length > 0;
    return appointments.filter((item) => (isSearching || matchesFilter(item, activeFilter)) && matchesSearch(item, search));
  }, [activeFilter, appointments, search]);

  function confirmAppointment() {
    const item = modal.appointment;
    confirmSharedAppointment(item.id);
    setFeedback(`${item.patient}'s appointment has been confirmed.`);
    setModal(null);
  }

  function saveReschedule(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = data.get("date"); const time = data.get("time"); const reason = data.get("reason").trim();
    if (!date || !time) return;
    const item = modal.appointment;
    const validSlots = getAvailableSlots({ date, doctor:item.doctor, appointmentId:item.id, appointments });
    if (!validSlots.includes(time)) {
      setFeedback("That time is no longer available. Please select another appointment slot.");
      return;
    }
    rescheduleAppointment(item.id, { date, time, reason });
    setFeedback(`${item.patient}'s appointment was rescheduled.`);
    setModal(null);
  }

  function saveCancellation(event) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get("reason").trim();
    if (!reason) return;
    adminCancelAppointment(modal.appointment.id, { reason });
    setFeedback(`${modal.appointment.patient}'s appointment was cancelled and retained in history.`);
    setModal(null);
  }

  return (
    <AdminLayout activePage="appointments" pageTitle="Appointments" pageSubtitle="Manage patient bookings, confirmations, rescheduling and cancellations.">
      {loading && <p role="status">Loading appointments…</p>}
      {!loading && error && <p role="alert">Appointments could not be loaded: {error}</p>}
      {feedback && <div className="admin-appointments-feedback" role="status"><FaCheck />{feedback}<button type="button" onClick={() => setFeedback("")} aria-label="Dismiss"><FaTimes /></button></div>}
      <section className="admin-appointments-heading"><div><span>Appointment Management</span><h2>Appointments</h2><p>Manage patient bookings, confirmations, rescheduling and cancellations.</p></div><button type="button" className="admin-add-appointment-button" onClick={() => setModal({ type:"create" })}><FaPlus /> Add Appointment</button></section>
      <section className="admin-appointments-summary">
        <article><div className="teal"><FaCalendarAlt /></div><p><strong>{appointments.filter((item) => item.date === TODAY).length}</strong><span>Today&apos;s Appointments</span><small>Scheduled for today</small></p></article>
        <article><div className="orange"><FaUserClock /></div><p><strong>{appointments.filter((item) => item.status === "Pending").length}</strong><span>Pending Confirmation</span><small>Requires admin action</small></p></article>
        <article><div className="green"><FaUserCheck /></div><p><strong>{appointments.filter((item) => item.status === "Confirmed").length}</strong><span>Confirmed</span><small>Active bookings</small></p></article>
        <article><div className="red"><FaTimes /></div><p><strong>{appointments.filter((item) => item.status === "Cancelled").length}</strong><span>Cancelled</span><small>Retained in history</small></p></article>
      </section>
      <section className="admin-appointments-toolbar">
        <div className="admin-appointments-tabs" role="tablist">{filters.map((filter) => <button type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? "active" : ""} key={filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}<span>{counts[filter.id]}</span></button>)}</div>
        <label className="admin-appointments-search"><FaSearch /><span className="admin-appointments-sr-only">Search appointments</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, ID, treatment or doctor" /></label>
      </section>
      <section className="admin-appointments-panel"><header><div><span>{search.trim() ? "Search Results" : `${filters.find((item) => item.id === activeFilter).label} Appointments`}</span><h3>Appointment List</h3></div><p>{visibleAppointments.length} {visibleAppointments.length === 1 ? "record" : "records"} displayed</p></header>
        <div className="admin-appointments-list">{visibleAppointments.length ? visibleAppointments.map((item) => <AppointmentCard key={item.id} appointment={item} setModal={setModal} />) : <div className="admin-appointments-empty"><FaCalendarAlt /><h3>No appointments found</h3><p>Try another filter or search term.</p></div>}</div>
      </section>
      {modal?.type === "details" && <DetailsModal appointment={modal.appointment} onClose={() => setModal(null)} />}
      {modal?.type === "create" && <CreateModal patients={patients} getOptions={getAdminBookingOptions} getAvailability={getAvailability} onClose={() => setModal(null)} onCreate={adminAddAppointment} onCreateNew={adminAddAppointmentForNewPatient} onCreated={(appointment, isNew) => { setModal(null); setFeedback(`${appointment.patientName}'s appointment was added.`); if (isNew) reloadIdentity().catch(() => {}); }} />}
      {modal?.type === "confirm" && <ConfirmModal appointment={modal.appointment} onClose={() => setModal(null)} onConfirm={confirmAppointment} />}
      {modal?.type === "reschedule" && <RescheduleModal appointment={modal.appointment} appointments={appointments} onClose={() => setModal(null)} onSave={saveReschedule} />}
      {modal?.type === "cancel" && <CancelModal appointment={modal.appointment} onClose={() => setModal(null)} onSave={saveCancellation} />}
    </AdminLayout>
  );
}

function AppointmentCard({ appointment, setModal }) {
  const canManage = ["Pending","Confirmed"].includes(appointment.status);
  const initials = appointment.patient.split(" ").map((part) => part[0]).join("").slice(0,2);

  return (
    <article className="admin-appointment-card">
      <div className="admin-appointment-patient">
        <div className="admin-appointment-avatar">{initials}</div>
        <div>
          <span>Patient</span>
          <h3>{appointment.patient}</h3>
          <small>{appointment.patientId}</small>
        </div>
      </div>

      <div className="admin-appointment-details">
        <span>Dental Service</span>
        <h4>{appointment.treatment}</h4>
        <small>{appointment.doctor}</small>
        <div className="admin-appointment-meta">
          <span><FaCalendarAlt />{formatDate(appointment.date)}</span>
          <span><FaClock />{appointment.time}</span>
        </div>
      </div>

      <div className="admin-appointment-note">
        <FaStickyNote />
        <p><strong>Patient note</strong>{appointment.note || "No note provided."}</p>
      </div>

      <div className="admin-appointment-card-actions">
        <span className={`admin-appointment-badge ${appointment.status.toLowerCase()}`}>{appointment.status}</span>
        <div>
          <button type="button" onClick={() => setModal({ type:"details", appointment })}>View Details</button>
          {appointment.status === "Pending" && <button type="button" className="confirm" onClick={() => setModal({ type:"confirm", appointment })}>Confirm</button>}
          {canManage && (
            <>
              <button type="button" onClick={() => setModal({ type:"reschedule", appointment })}>Reschedule</button>
              <button type="button" className="danger" onClick={() => setModal({ type:"cancel", appointment })}>Cancel Appointment</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Modal({ title, eyebrow, onClose, children, footer }) { return <div className="admin-appointment-modal-overlay" onMouseDown={onClose}><section className="admin-appointment-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><FaCalendarAlt /></div><span><small>{eyebrow}</small><h2>{title}</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes /></button></header>{children}{footer && <footer>{footer}</footer>}</section></div>; }
function DetailsModal({ appointment, onClose }) { const details = [["Patient",appointment.patient],["Patient ID",appointment.patientId],["Treatment",appointment.treatment],["Doctor",appointment.doctor],["Date",formatDate(appointment.date)],["Time",appointment.time],["Status",appointment.status],["Patient Note",appointment.note],["Booked On",appointment.bookedAt],["Booking Source",appointment.bookingSource],...(appointment.status === "Cancelled" ? [["Cancelled By",appointment.cancelledBy],["Cancellation Reason",appointment.cancellationReason]] : []),...(appointment.rescheduleReason ? [["Reschedule Note",appointment.rescheduleReason]] : [])]; return <Modal title="Appointment Details" eyebrow={appointment.id} onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}><div className="admin-appointment-modal-grid">{details.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || "—"}</strong></div>)}</div></Modal>; }
function ConfirmModal({ appointment, onClose, onConfirm }) { return <Modal title="Confirm Appointment" eyebrow="Confirmation Required" onClose={onClose} footer={<><button type="button" onClick={onClose}>Keep Pending</button><button type="button" className="primary" onClick={onConfirm}>Confirm Appointment</button></>}><div className="admin-appointment-confirm-copy"><FaUserCheck /><p><strong>Confirm {appointment.patient}&apos;s appointment?</strong><span>{formatDate(appointment.date)} at {appointment.time} · {appointment.treatment}</span></p></div></Modal>; }
function RescheduleModal({ appointment, appointments, onClose, onSave }) {
  const [mode, setMode] = useState("earliest");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [visibleDateCount, setVisibleDateCount] = useState(3);
  const earliestDates = useMemo(
    () => getEarliestAvailableDates({ doctor:appointment.doctor, appointmentId:appointment.id, appointments }),
    [appointment.doctor, appointment.id, appointments]
  );
  const availableSlots = getAvailableSlots({ date, doctor:appointment.doctor, appointmentId:appointment.id, appointments });
  const isClosedDate = date && (new Date(`${date}T00:00:00`).getDay() === 0 || clinicClosedDates.includes(date));

  function chooseSlot(nextDate, nextTime) {
    setDate(nextDate);
    setTime(nextTime);
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setDate("");
    setTime("");
  }

  return <Modal title="Reschedule Appointment" eyebrow={appointment.patient} onClose={onClose}>
    <div className="admin-reschedule-summary">
      <div><span>Patient</span><strong>{appointment.patient}</strong><small>{appointment.patientId}</small></div>
      <div><span>Treatment</span><strong>{appointment.treatment}</strong></div>
      <div><span>Doctor</span><strong>{appointment.doctor}</strong></div>
      <div><span>Current Appointment</span><strong>{formatDate(appointment.date)}</strong><small>{appointment.time}</small></div>
    </div>
    <form className="admin-appointment-form admin-reschedule-form" onSubmit={onSave}>
      <section className="admin-slot-finder wide">
        <header><div><span>Find Available Slot</span><p>Select one of {appointment.doctor}&apos;s available appointment times.</p></div></header>
        <div className="admin-slot-mode-tabs" role="tablist" aria-label="Availability search mode">
          <button type="button" role="tab" aria-selected={mode === "earliest"} className={mode === "earliest" ? "active" : ""} onClick={() => changeMode("earliest")}>Earliest Available</button>
          <button type="button" role="tab" aria-selected={mode === "date"} className={mode === "date" ? "active" : ""} onClick={() => changeMode("date")}>Choose Date</button>
        </div>

        {mode === "earliest" && <div className="admin-earliest-dates">
          {earliestDates.slice(0, visibleDateCount).map((group) => <article className={date === group.date ? "has-selection" : ""} key={group.date}>
            <h4>{formatAvailabilityDate(group.date)}</h4>
            <div>{group.slots.map((slot) => <button type="button" key={slot} className={date === group.date && time === slot ? "selected" : ""} aria-pressed={date === group.date && time === slot} onClick={() => chooseSlot(group.date, slot)}>{slot}</button>)}</div>
          </article>)}
          {visibleDateCount < earliestDates.length && <button type="button" className="admin-show-more-dates" onClick={() => setVisibleDateCount((count) => Math.min(count + 3, earliestDates.length))}>Show More Dates</button>}
        </div>}

        {mode === "date" && <div className="admin-date-availability">
          <label><span>Choose Date</span><input type="date" min={TODAY} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></label>
          {date && <div className="admin-chosen-date"><strong>{formatAvailabilityDate(date)}</strong><span>Available Time Slots</span></div>}
          {date && availableSlots.length > 0 && <div className="admin-date-slot-grid">{availableSlots.map((slot) => <button type="button" key={slot} className={time === slot ? "selected" : ""} aria-pressed={time === slot} onClick={() => setTime(slot)}>{slot}</button>)}</div>}
          {date && availableSlots.length === 0 && <p className="unavailable">{isClosedDate ? "The clinic is closed on this date. Please select another date." : "No available appointment slots for this date."}</p>}
          {!date && <p>Select a date to check the doctor&apos;s availability.</p>}
        </div>}
      </section>
      {date && time && <div className="admin-selected-slot wide" role="status"><span>Selected Appointment</span><strong>{formatAvailabilityDate(date)}</strong><small>{time}</small></div>}
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <label className="wide"><span>Admin Reason <small>(Optional)</small></span><textarea name="reason" rows="3" placeholder="Add a note explaining the schedule change" /></label>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={!date || !time}>Confirm Reschedule</button></footer>
    </form>
  </Modal>;
}
function CancelModal({ appointment, onClose, onSave }) { return <Modal title="Cancel Appointment" eyebrow="Appointment remains in history" onClose={onClose}><form className="admin-appointment-form cancel-form" onSubmit={onSave}><div className="admin-cancel-warning"><FaTimes /><p><strong>Cancel {appointment.patient}&apos;s appointment?</strong><span>{formatDate(appointment.date)} at {appointment.time}</span></p></div><label className="wide"><span>Cancellation Reason *</span><textarea name="reason" rows="4" required placeholder="Enter the reason for cancellation" /></label><footer><button type="button" onClick={onClose}>Keep Appointment</button><button type="submit" className="danger">Confirm Cancellation</button></footer></form></Modal>; }

function CreateModal({ patients, getOptions, getAvailability, onClose, onCreate, onCreateNew, onCreated }) {
  const [patientType, setPatientType] = useState("existing");
  const [options, setOptions] = useState({ services:[], doctors:[] });
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const clinicParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kuala_Lumpur", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const clinicDate = `${clinicParts.year}-${clinicParts.month}-${clinicParts.day}`;
  const matchingPatients = patients.filter((patient) => patient.accountStatus === "Active" && normalizeSearchValue(`${patient.fullName} ${patient.patientId}`).includes(normalizeSearchValue(patientSearch)));
  useEffect(() => { let active = true; getOptions().then((data) => { if (active) setOptions({ services:data.services || [], doctors:data.doctors || [] }); }).catch((failure) => { if (active) setError(failure.message); }); return () => { active = false; }; }, [getOptions]);
  useEffect(() => {
    let active = true;
    if (!doctorId || !serviceId || !date) return undefined;
    getAvailability({ doctorId, serviceId, date }).then((data) => { if (active) { setSlots(data.slots || []); setError(""); setChecking(false); } }).catch((failure) => { if (active) { setSlots([]); setError(failure.message); setChecking(false); } });
    return () => { active = false; };
  }, [doctorId, serviceId, date, getAvailability]);
  function changeSelection(setter, value) { setter(value); setTime(""); setSlots([]); setChecking(Boolean(value)); setError(""); }
  async function submit(event) {
    event.preventDefault();
    if ((patientType === "existing" && !patientId) || !serviceId || !doctorId || !date || !slots.includes(time)) return;
    const data = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try { const shared = { dentalServiceId:serviceId, doctorId, date, time, bookingSource:data.get("bookingSource"), patientNote:data.get("patientNote").trim() }; const appointment = patientType === "existing" ? await onCreate({ ...shared, patientId }) : await onCreateNew({ ...shared, fullName:data.get("fullName").trim(), phone:data.get("phone").trim(), email:data.get("email").trim(), identityNumber:data.get("identityNumber").trim() }); onCreated(appointment, patientType === "new"); }
    catch (failure) { setError(failure.message); if (failure.status === 409) { setTime(""); setSlots([]); getAvailability({ doctorId, serviceId, date }).then((result) => setSlots(result.slots || [])).catch(() => {}); } }
    finally { setSaving(false); }
  }
  return <Modal title="Add Appointment" eyebrow="Patient Booking" onClose={onClose}><form className="admin-appointment-form admin-create-form" onSubmit={submit}>
    <div className="admin-create-patient-tabs wide" role="tablist" aria-label="Patient type"><button type="button" role="tab" aria-selected={patientType === "existing"} className={patientType === "existing" ? "active" : ""} onClick={() => { setPatientType("existing"); setError(""); }}>Existing Patient</button><button type="button" role="tab" aria-selected={patientType === "new"} className={patientType === "new" ? "active" : ""} onClick={() => { setPatientType("new"); setError(""); }}>New Patient</button></div>
    {error && <p className="admin-create-error wide" role="alert">{error}</p>}
    {patientType === "existing" ? <><label className="wide"><span>Search Patient</span><input type="search" value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); setPatientId(""); }} placeholder="Search by patient name or ID" /></label><label className="wide"><span>Patient *</span><select required value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Select an existing patient</option>{matchingPatients.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.fullName} ({patient.patientId})</option>)}</select></label></> : <><label className="wide"><span>Full Name *</span><input name="fullName" required minLength="2" maxLength="150" autoComplete="name" /></label><label><span>Phone Number *</span><input name="phone" type="tel" required minLength="7" maxLength="30" autoComplete="tel" /></label><label><span>Email <small>(Optional)</small></span><input name="email" type="email" maxLength="254" autoComplete="email" /></label><label className="wide"><span>IC Number / Passport Number <small>(Optional)</small></span><input name="identityNumber" maxLength="32" /></label></>}
    <label><span>Service *</span><select required value={serviceId} onChange={(event) => changeSelection(setServiceId, event.target.value)}><option value="">Select service</option>{options.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
    <label><span>Doctor *</span><select required value={doctorId} onChange={(event) => changeSelection(setDoctorId, event.target.value)}><option value="">Select doctor</option>{options.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
    <label><span>Date *</span><input type="date" required min={clinicDate} value={date} onChange={(event) => changeSelection(setDate, event.target.value)} /></label>
    <label><span>Available Time *</span><select required value={time} disabled={!date || !serviceId || !doctorId || checking || !slots.length} onChange={(event) => setTime(event.target.value)}><option value="">{checking ? "Checking availability…" : slots.length ? "Select available time" : "No available times"}</option>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
    <label><span>Booking Source *</span><select name="bookingSource" required defaultValue="Admin"><option>Phone</option><option>WhatsApp</option><option>Walk-in</option><option>Admin</option></select></label>
    <label className="wide"><span>Notes <small>(Optional)</small></span><textarea name="patientNote" rows="3" maxLength="2000" placeholder="Add any booking notes" /></label>
    <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving || checking || (patientType === "existing" && !patientId) || !slots.includes(time)}>{saving ? "Saving…" : "Add Appointment"}</button></footer>
  </form></Modal>;
}

export default AdminAppointments;
