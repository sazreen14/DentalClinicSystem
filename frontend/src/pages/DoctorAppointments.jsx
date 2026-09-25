import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  FaCalendarAlt,
  FaChevronRight,
  FaClipboardList,
  FaClock,
  FaSearch,
  FaStickyNote,
  FaTimes,
  FaUser,
} from "react-icons/fa";

import DoctorLayout from "../components/doctor/DoctorLayout";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";

import "../styles/DoctorAppointments.css";

/* Appointment data is supplied by AppointmentsContext. */
const tabs = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function DoctorAppointments() {
  const location = useLocation();
  const navigate = useNavigate();
  const { appointments: sharedAppointments, loading, error } = useAppointments();
  const { patients } = useIdentity();
  const appointments = useMemo(() => sharedAppointments.map((item) => ({ ...item, patient:patients.find((patient)=>patient.patientId===item.patientId)?.fullName||item.patientName, treatment:item.service, doctor:item.doctorName, note:item.patientNote, group:item.date === APPOINTMENT_REFERENCE_DATE ? "today" : item.date > APPOINTMENT_REFERENCE_DATE ? "upcoming" : item.status.toLowerCase(), date:new Date(`${item.date}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }) })), [sharedAppointments,patients]);
  const [activeTab, setActiveTab] = useState("today");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState(() => location.state?.appointment || null);

  const filteredAppointments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const isInTab =
        activeTab === "completed"
          ? appointment.status === "Completed"
          : activeTab === "cancelled"
            ? appointment.status === "Cancelled"
            : appointment.group === activeTab &&
              !["Completed", "Cancelled"].includes(appointment.status);
      const matchesSearch = `${appointment.patient} ${appointment.patientId} ${appointment.treatment}`
        .toLowerCase()
        .includes(query);

      return isInTab && matchesSearch;
    });
  }, [activeTab, appointments, searchTerm]);

  function getTabCount(tabId) {
    if (tabId === "completed") {
      return appointments.filter((appointment) => appointment.status === "Completed").length;
    }
    if (tabId === "cancelled") {
      return appointments.filter((appointment) => appointment.status === "Cancelled").length;
    }
    return appointments.filter(
      (appointment) =>
        appointment.group === tabId &&
        !["Completed", "Cancelled"].includes(appointment.status)
    ).length;
  }

  return (
    <DoctorLayout
      activePage="appointments"
      pageTitle="Appointments"
      pageSubtitle="Manage upcoming and completed patient visits"
      doctorName="Dr. Rosni Adam"
      doctorInitials="RA"
    >
      {loading && <p role="status">Loading appointments…</p>}
      {!loading && error && <p role="alert">Appointments could not be loaded: {error}</p>}
      <section className="doctor-appointments-heading">
        <div>
          <span>Schedule Management</span>
          <h2>Appointments</h2>
          <p>Manage upcoming visits, completed treatments, and patient schedules.</p>
        </div>

        <div className="doctor-appointments-heading-icon" aria-hidden="true">
          <FaCalendarAlt />
        </div>
      </section>

      <section className="doctor-appointments-toolbar">
        <div className="doctor-appointments-tabs" role="tablist" aria-label="Appointment status">
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span>{getTabCount(tab.id)}</span>
            </button>
          ))}
        </div>

        <label className="doctor-appointments-search">
          <FaSearch aria-hidden="true" />
          <span className="doctor-appointments-sr-only">Search appointments</span>
          <input
            type="search"
            placeholder="Search patient or treatment"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </section>

      <section className="doctor-appointments-panel">
        <div className="doctor-appointments-panel-heading">
          <div>
            <span>{tabs.find((tab) => tab.id === activeTab)?.label} Schedule</span>
            <h3>Patient Appointments</h3>
          </div>
          <p>{filteredAppointments.length} appointment{filteredAppointments.length === 1 ? "" : "s"}</p>
        </div>

        <div className="doctor-appointments-list">
          {filteredAppointments.length > 0 ? (
            filteredAppointments.map((appointment) => {
              const initials = appointment.patient
                .split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2);

              return (
                <article className="doctor-appointment-card" key={appointment.id}>
                  <div className="doctor-appointment-patient">
                    <div className="doctor-appointment-avatar">{initials}</div>
                    <div>
                      <span>Patient</span>
                      <h3>{appointment.patient}</h3>
                      <small>{appointment.patientId}</small>
                    </div>
                  </div>

                  <div className="doctor-appointment-details">
                    <span>Dental Service</span>
                    <h4>{appointment.treatment}</h4>
                    <div className="doctor-appointment-meta">
                      <span><FaCalendarAlt />{appointment.date}</span>
                      <span><FaClock />{appointment.time}</span>
                    </div>
                  </div>

                  <div className="doctor-appointment-note">
                    <FaStickyNote />
                    <p><strong>Patient note</strong>{appointment.note}</p>
                  </div>

                  <div className="doctor-appointment-card-actions">
                    <span className={`doctor-appointment-status ${appointment.status.toLowerCase().replace(" ", "-")}`}>
                      {appointment.status}
                    </span>
                    <div>
                      <button type="button" onClick={() => setSelectedAppointment(appointment)}>
                        View Details <FaChevronRight />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/doctor-patient-records", { state: { patientId: appointment.patientId, appointmentId: appointment.id, from: "/doctor-appointments" } })}
                      >
                        <FaClipboardList /> View Patient Record
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="doctor-appointments-empty">
              <FaUser />
              <h3>No appointments found</h3>
              <p>Try another filter or search term.</p>
            </div>
          )}
        </div>
      </section>
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onViewPatientRecord={() => navigate("/doctor-patient-records", { state: { patientId: selectedAppointment.patientId, appointmentId: selectedAppointment.id, from: "/doctor-appointments" } })}
        />
      )}
    </DoctorLayout>
  );
}

function AppointmentDetailsModal({ appointment, onClose, onViewPatientRecord }) {
  const details = [
    ["Patient Name", appointment.patient],
    ["Patient ID", appointment.patientId],
    ["Appointment ID", appointment.id],
    ["Dental Service / Treatment", appointment.treatment],
    ["Appointment Date", appointment.date],
    ["Appointment Time", appointment.time],
    ["Doctor", appointment.doctor],
  ];

  return (
    <div className="doctor-appointment-details-overlay" onMouseDown={onClose}>
      <section className="doctor-appointment-details-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="doctor-appointment-details-header">
          <div><FaCalendarAlt /></div>
          <span><small>Appointment Overview</small><h2 id="appointment-details-title">Appointment Details</h2></span>
          <button type="button" onClick={onClose} aria-label="Close appointment details"><FaTimes /></button>
        </header>
        <div className="doctor-appointment-details-patient">
          <div className="doctor-appointment-details-avatar">{appointment.patient.split(" ").map((name) => name[0]).join("").slice(0, 2)}</div>
          <div><span>Patient</span><h3>{appointment.patient}</h3><p>{appointment.patientId}</p></div>
          <span className={`doctor-appointment-status ${appointment.status.toLowerCase().replace(" ", "-")}`}>{appointment.status}</span>
        </div>
        <div className="doctor-appointment-details-grid">
          {details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="doctor-appointment-details-note"><FaStickyNote /><div><span>Patient Note</span><p>{appointment.note || "No patient note provided."}</p></div></div>
        <footer className="doctor-appointment-details-actions">
          <button type="button" onClick={onClose}>Close</button>
          <button type="button" className="primary" onClick={onViewPatientRecord}><FaClipboardList /> View Patient Record</button>
        </footer>
      </section>
    </div>
  );
}

export default DoctorAppointments;
