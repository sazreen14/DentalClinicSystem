import { useState } from "react";
import {
  FaBuilding,
  FaCalendarTimes,
  FaCheck,
  FaClock,
  FaEdit,
  FaPlus,
  FaSave,
  FaTimes,
  FaTooth,
} from "react-icons/fa";
import AdminLayout from "../components/admin/AdminLayout";
import { useClinicOperations } from "../context/useClinicOperations";
import "../styles/AdminClinicOperations.css";

const formatTime = (time) => new Date(`2026-08-09T${time}:00`).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

function AdminClinicOperations() {
  const { clinicInfo:clinic, operatingHours:hours, appointmentTimeSlots:slots, recurringBreaks=[], closedDates, dentalServices:services, updateClinicInfo, updateOperatingHours, addAppointmentTimeSlot, toggleAppointmentTimeSlot, addRecurringBreak, updateRecurringBreak, toggleRecurringBreak, removeRecurringBreak, addClosedDate:commitClosedDate, removeClosedDate, addService, updateService, toggleServiceStatus } = useClinicOperations();
  const [clinicDraft, setClinicDraft] = useState(clinic);
  const [editingClinic, setEditingClinic] = useState(false);
  const [hoursDraft, setHoursDraft] = useState(hours);
  const [editingHours, setEditingHours] = useState(false);
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState("");
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = hours.find((item) => item.day === todayName) || hours[0] || { open:false, start:null, end:null };
  const activeSlotCount = slots.filter((slot) => slot.enabled).length;
  const activeServiceCount = services.filter((service) => service.status === "Active").length;

  function notify(message) {
    setFeedback(message);
  }

  async function saveClinic(event) {
    event.preventDefault();
    await updateClinicInfo(clinicDraft);
    setEditingClinic(false);
    notify("Clinic information was updated.");
  }

  async function saveHours() {
    const invalid = hoursDraft.some((item) => item.open && item.start >= item.end);
    if (invalid) {
      notify("Closing time must be later than opening time for every open day.");
      return;
    }
    await updateOperatingHours(hoursDraft);
    setEditingHours(false);
    notify("Operating hours were updated.");
  }

  async function addSlot(event) {
    event.preventDefault();
    const time = new FormData(event.currentTarget).get("time");
    if (slots.some((slot) => slot.time === time)) {
      notify("That appointment time slot already exists.");
      return;
    }
    await addAppointmentTimeSlot(time);
    setModal(null);
    notify(`${formatTime(time)} was added as an appointment time slot.`);
  }

  async function addClosedDate(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (closedDates.some((item) => item.date === values.date)) {
      notify("That date is already blocked.");
      return;
    }
    await commitClosedDate(values);
    setModal(null);
    notify(`${formatDate(values.date)} was added to closed dates.`);
  }

  async function saveService(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const serviceValues = { ...values, duration: Number(values.duration) };
    if (modal.service) {
      await updateService(modal.service.id, serviceValues);
      notify(`${values.name} was updated.`);
    } else {
      await addService(serviceValues);
      notify(`${values.name} was added to dental services.`);
    }
    setModal(null);
  }
  async function saveBreak(event) {event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));const payload={day:values.day,start:values.start,end:values.end,enabled:true};if(modal.breakItem)await updateRecurringBreak(modal.breakItem.id,{...payload,enabled:modal.breakItem.enabled});else await addRecurringBreak(payload);setModal(null);notify('Recurring clinic break was saved.');}

  return (
    <AdminLayout activePage="operations" pageTitle="Clinic Operations" pageSubtitle="Manage clinic availability and services.">
      {feedback && <div className="admin-operations-feedback" role="status"><FaCheck /> <span>{feedback}</span><button type="button" onClick={() => setFeedback("")} aria-label="Dismiss feedback"><FaTimes /></button></div>}

      <section className="admin-operations-heading">
        <div><span>Clinic Management</span><h2>Clinic Operations</h2><p>Manage clinic information, availability, blocked dates and patient-facing services.</p></div>
        <div className="admin-operations-heading-icon"><FaBuilding /></div>
      </section>

      <section className="admin-clinic-hero">
        <div className="admin-clinic-hero-top">
          <div className="admin-clinic-hero-brand"><div><FaBuilding /></div><span><small>Clinic Overview</small><h3>{clinic.clinicName}</h3><p>Core availability and patient-facing operations at a glance.</p></span></div>
          {!editingClinic && <button type="button" onClick={() => { setClinicDraft(clinic); setEditingClinic(true); }}><FaEdit /> Edit Clinic Information</button>}
        </div>
        {editingClinic ? (
          <form className="admin-operations-form admin-clinic-hero-form" onSubmit={saveClinic}>
            <Field label="Clinic Name"><input required value={clinicDraft.clinicName} onChange={(event) => setClinicDraft({ ...clinicDraft, clinicName: event.target.value })} /></Field>
            <Field label="Phone Number"><input required value={clinicDraft.phone} onChange={(event) => setClinicDraft({ ...clinicDraft, phone: event.target.value })} /></Field>
            <Field label="Email"><input required type="email" value={clinicDraft.email} onChange={(event) => setClinicDraft({ ...clinicDraft, email: event.target.value })} /></Field>
            <Field label="Address" wide><textarea required rows="3" value={clinicDraft.address} onChange={(event) => setClinicDraft({ ...clinicDraft, address: event.target.value })} /></Field>
            <div className="admin-operations-form-actions"><button type="button" onClick={() => { setClinicDraft(clinic); setEditingClinic(false); }}>Cancel</button><button type="submit" className="primary"><FaSave /> Save Changes</button></div>
          </form>
        ) : (
          <div className="admin-clinic-hero-content">
            <div className="admin-clinic-hero-metrics">
              <article className={todayHours.open ? "open" : "closed"}><span>Clinic Status</span><strong>{todayHours.open ? "Open" : "Closed"}</strong><small>{todayName}</small></article>
              <article><span>Today&apos;s Hours</span><strong>{todayHours.open ? `${formatTime(todayHours.start)} - ${formatTime(todayHours.end)}` : "Closed today"}</strong><small>Weekly operating schedule</small></article>
              <article><span>Active Slots</span><strong>{activeSlotCount}</strong><small>Available booking times</small></article>
              <article><span>Active Services</span><strong>{activeServiceCount}</strong><small>Patient-facing services</small></article>
            </div>
            <div className="admin-clinic-contact"><Info label="Phone" value={clinic.phone} /><Info label="Email" value={clinic.email} /><Info label="Location" value={clinic.address} wide /></div>
          </div>
        )}
      </section>

      <div className="admin-operations-grid">

        <OperationCard className="hours-card" icon={<FaClock />} eyebrow="Weekly Availability" title="Operating Hours" description="Standard opening and closing times." action={!editingHours && <button type="button" onClick={() => { setHoursDraft(hours.map((item) => ({ ...item }))); setEditingHours(true); }}><FaEdit /> Edit Hours</button>}>
          <div className="admin-hours-list">
            <div className="admin-hours-table-head"><span>Day</span><span>Status</span><span>Opening Time</span><span>Closing Time</span></div>
            {(editingHours ? hoursDraft : hours).map((item, index) => (
              <div className="admin-hours-row" key={item.day}>
                <strong>{item.day}</strong>
                {editingHours ? <>
                  <div className="admin-hours-status-control"><Toggle checked={item.open} label={`${item.day} is ${item.open ? "open" : "closed"}`} onChange={() => setHoursDraft((items) => items.map((day, dayIndex) => dayIndex === index ? { ...day, open: !day.open } : day))} /><span>{item.open ? "Open" : "Closed"}</span></div>
                  <input className="admin-hours-time" aria-label={`${item.day} opening time`} type="time" disabled={!item.open} value={item.start} onChange={(event) => setHoursDraft((items) => items.map((day, dayIndex) => dayIndex === index ? { ...day, start: event.target.value } : day))} />
                  <input className="admin-hours-time" aria-label={`${item.day} closing time`} type="time" disabled={!item.open} value={item.end} onChange={(event) => setHoursDraft((items) => items.map((day, dayIndex) => dayIndex === index ? { ...day, end: event.target.value } : day))} />
                </> : <><span className={`admin-hours-status ${item.open ? "open" : "closed"}`}>{item.open ? "Open" : "Closed"}</span><span className="admin-hours-value">{item.open ? formatTime(item.start) : "—"}</span><span className="admin-hours-value">{item.open ? formatTime(item.end) : "—"}</span></>}
              </div>
            ))}
          </div>
          {editingHours && <div className="admin-card-footer-actions"><button type="button" onClick={() => { setHoursDraft(hours); setEditingHours(false); }}>Cancel</button><button type="button" className="primary" onClick={saveHours}><FaSave /> Save Changes</button></div>}
        </OperationCard>

        <OperationCard className="slots-card" icon={<FaClock />} eyebrow="Booking Availability" title="Appointment Time Slots" description="Times patients may select when booking." action={<button type="button" onClick={() => setModal({ type: "slot" })}><FaPlus /> Add Time Slot</button>}>
          <div className="admin-slot-list">
            {slots.map((slot) => <div className={`admin-slot ${slot.enabled ? "" : "disabled"}`} key={slot.id}><strong>{formatTime(slot.time)}</strong><Toggle checked={slot.enabled} label={`${slot.enabled ? "Disable" : "Enable"} ${formatTime(slot.time)}`} onChange={() => toggleAppointmentTimeSlot(slot.id)} /></div>)}
          </div>
          <p className="admin-operations-note">Disabled or removed slots do not affect historical appointments.</p>
        </OperationCard>

        <OperationCard className="breaks-card" icon={<FaClock />} eyebrow="Recurring Availability" title="Clinic Breaks" description="Weekly periods unavailable for appointment booking." action={<button type="button" onClick={() => setModal({ type:"break" })}><FaPlus /> Add Break</button>}><div className="admin-break-list">{recurringBreaks.map(item=><article key={item.id}><strong>{item.day}</strong><span>{formatTime(item.start)} – {formatTime(item.end)}</span>{item.fixed?<em>Fixed clinic break</em>:<><Toggle checked={item.enabled} label={`${item.enabled?'Disable':'Enable'} ${item.day} break`} onChange={()=>toggleRecurringBreak(item.id)} /><button type="button" onClick={()=>setModal({type:'break',breakItem:item})}><FaEdit /> Edit</button><button type="button" aria-label={`Remove ${item.day} break`} onClick={async()=>{if(window.confirm(`Remove the ${item.day} clinic break?`)){await removeRecurringBreak(item.id);notify('Recurring clinic break was removed.');}}}><FaTimes /></button></>}</article>)}</div></OperationCard>

        <OperationCard className="closed-card" icon={<FaCalendarTimes />} eyebrow="Unavailable Dates" title="Closed Dates" description="Dates unavailable for patient booking." action={<button type="button" onClick={() => setModal({ type: "closed-date" })}><FaPlus /> Add Closed Date</button>}>
          <div className="admin-closed-list">
            {closedDates.map((item) => <article key={item.id}><time>{formatDate(item.date)}</time><div><strong>{item.reason}</strong><span>{item.type}</span></div><button type="button" onClick={() => { removeClosedDate(item.id); notify(`${formatDate(item.date)} is available again.`); }} aria-label={`Remove ${formatDate(item.date)}`}><FaTimes /></button></article>)}
          </div>
        </OperationCard>

        <OperationCard className="services-card" icon={<FaTooth />} eyebrow="Patient-facing Catalogue" title="Dental Services" description="Services available for appointment booking." action={<button type="button" onClick={() => setModal({ type: "service" })}><FaPlus /> Add Service</button>}>
          <div className="admin-service-list">
            <div className="admin-service-table-head"><span>Service</span><span>Duration</span><span>Status</span><span>Actions</span></div>
            {services.map((service) => <article key={service.id}><div className="admin-service-icon"><FaTooth /></div><div><strong>{service.name}</strong></div><span className="admin-service-duration">{service.duration} minutes</span><span className={`admin-service-status ${service.status.toLowerCase()}`}>{service.status}</span><div className="admin-service-actions"><button type="button" onClick={() => setModal({ type: "service", service })}><FaEdit /> Edit</button><button type="button" onClick={() => { const status = service.status === "Active" ? "Inactive" : "Active"; toggleServiceStatus(service.id); notify(`${service.name} is now ${status.toLowerCase()}. Historical appointments are unchanged.`); }}>{service.status === "Active" ? "Deactivate" : "Activate"}</button></div></article>)}
          </div>
        </OperationCard>
      </div>

      {modal?.type === "break" && <OperationsModal title={modal.breakItem?'Edit Clinic Break':'Add Clinic Break'} eyebrow="Recurring Availability" icon={<FaClock />} onClose={()=>setModal(null)}><form className="admin-operations-modal-form two-column" onSubmit={saveBreak}><Field label="Day"><select name="day" defaultValue={modal.breakItem?.day||'Monday'}>{hours.filter(item=>item.open).map(item=><option key={item.day}>{item.day}</option>)}</select></Field><Field label="Start Time"><input name="start" type="time" defaultValue={modal.breakItem?.start||'13:00'} required /></Field><Field label="End Time"><input name="end" type="time" defaultValue={modal.breakItem?.end||'14:00'} required /></Field><ModalActions onClose={()=>setModal(null)} submitLabel="Save Break" /></form></OperationsModal>}
      {modal?.type === "slot" && <OperationsModal title="Add Time Slot" eyebrow="Booking Availability" icon={<FaClock />} onClose={() => setModal(null)}><form className="admin-operations-modal-form" onSubmit={addSlot}><Field label="Appointment Time"><input name="time" type="time" required /></Field><ModalActions onClose={() => setModal(null)} submitLabel="Add Time Slot" /></form></OperationsModal>}
      {modal?.type === "closed-date" && <OperationsModal title="Add Closed Date" eyebrow="Clinic Availability" icon={<FaCalendarTimes />} onClose={() => setModal(null)}><form className="admin-operations-modal-form two-column" onSubmit={addClosedDate}><Field label="Date"><input name="date" type="date" min="2026-08-10" required /></Field><Field label="Closure Type"><select name="type" defaultValue="Clinic Closed"><option>Public Holiday</option><option>Clinic Closed</option><option>Staff Training</option><option>Maintenance</option><option>Emergency Closure</option></select></Field><Field label="Reason" wide><input name="reason" required placeholder="Reason appointments are unavailable" /></Field><ModalActions onClose={() => setModal(null)} submitLabel="Add Closed Date" /></form></OperationsModal>}
      {modal?.type === "service" && <OperationsModal title={modal.service ? "Edit Dental Service" : "Add Dental Service"} eyebrow="Service Catalogue" icon={<FaTooth />} onClose={() => setModal(null)}><form className="admin-operations-modal-form" onSubmit={saveService}><Field label="Service Name"><input name="name" defaultValue={modal.service?.name || ""} required /></Field><Field label="Appointment Duration"><select name="duration" defaultValue={modal.service?.duration || 30}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></Field><Field label="Service Icon"><select name="iconKey" defaultValue={modal.service?.iconKey || "general"}><option value="general">General Dentistry</option><option value="scaling">Scaling</option><option value="filling">Filling</option><option value="extraction">Extraction</option><option value="braces">Braces</option><option value="whitening">Whitening</option><option value="consultation">Consultation</option><option value="xray">Dental X-Ray</option><option value="implant">Implant</option><option value="followup">Follow-up</option></select></Field><Field label="Public Description"><input name="description" defaultValue={modal.service?.description || ""} placeholder="Optional short service description" /></Field><ModalActions onClose={() => setModal(null)} submitLabel={modal.service ? "Save Service" : "Add Service"} /></form></OperationsModal>}
    </AdminLayout>
  );
}

function OperationCard({ icon, eyebrow, title, description, action, className = "", children }) {
  return <section className={`admin-operation-card ${className}`}><header><div className="admin-operation-card-icon">{icon}</div><div><span>{eyebrow}</span><h3>{title}</h3>{description && <p>{description}</p>}</div>{action && <div className="admin-operation-card-action">{action}</div>}</header>{children}</section>;
}
function Info({ label, value, wide = false }) { return <p className={wide ? "wide" : ""}><span>{label}</span><strong>{value}</strong></p>; }
function Field({ label, wide = false, children }) { return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>; }
function Toggle({ checked, onChange, label }) { return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`admin-operations-toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button>; }
function OperationsModal({ title, eyebrow, icon, onClose, children }) { return <div className="admin-operations-modal-overlay" onMouseDown={onClose}><section className="admin-operations-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div>{icon}</div><span><small>{eyebrow}</small><h2>{title}</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes /></button></header>{children}</section></div>; }
function ModalActions({ onClose, submitLabel }) { return <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary"><FaCheck /> {submitLabel}</button></footer>; }

export default AdminClinicOperations;
