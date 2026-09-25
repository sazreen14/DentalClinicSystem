import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaCalendarAlt,
  FaCheck,
  FaChevronRight,
  FaClipboardList,
  FaClock,
  FaTimes,
  FaTooth,
  FaUserFriends,
} from "react-icons/fa";

import DoctorLayout from "../components/doctor/DoctorLayout";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";
import { getDoctorPatients } from "../services/clinicalRecordsApi";

import "../styles/DoctorDashboard.css";

function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-MY", options);
}

function DoctorDashboard() {
  const navigate = useNavigate();
  const { appointments } = useAppointments();
  const { doctorProfile } = useIdentity();
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [patientError, setPatientError] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    let active = true;
    getDoctorPatients()
      .then((items) => { if (active) setDoctorPatients(items); })
      .catch((error) => { if (active) setPatientError(error.message); });
    return () => { active = false; };
  }, []);

  const doctorName = doctorProfile?.fullName || "Doctor";
  const todayAppointments = useMemo(() => appointments
    .filter((item) => item.date === APPOINTMENT_REFERENCE_DATE)
    .map((item) => ({
      ...item,
      appointmentId: item.id,
      patient: item.patientName,
      treatment: item.service,
      doctor: item.doctorName,
      note: item.patientNote,
      formattedDate: formatDate(item.date),
    })), [appointments]);
  const upcomingAppointments = appointments.filter((item) => item.date > APPOINTMENT_REFERENCE_DATE && !["Completed", "Cancelled"].includes(item.status));
  const completedAppointments = appointments.filter((item) => item.status === "Completed");
  const nextAppointment = appointments
    .filter((item) => item.date >= APPOINTMENT_REFERENCE_DATE && !["Completed", "Cancelled"].includes(item.status))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const recentRecords = [...doctorPatients]
    .filter((patient) => patient.lastVisit && patient.lastVisit !== "No visit")
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
    .slice(0, 3);

  function viewPatientRecord(patientId, appointmentId) {
    navigate("/doctor-patient-records", { state: { patientId, appointmentId, from: "/doctor-dashboard" } });
  }

  return (
    <DoctorLayout activePage="overview" pageTitle="Overview" doctorName={doctorName} doctorInitials="RA">
      <section className="doctor-dashboard-summary">
        <div>
          <span>Doctor Summary</span>
          <h2>{doctorName}</h2>
          <p>{doctorProfile?.specialization || "Specialization not provided"}</p>
        </div>
        <button type="button" onClick={() => navigate("/doctor-schedule")}><FaCalendarAlt /> View Schedule</button>
      </section>

      <section className="doctor-stat-grid" aria-label="Doctor summary statistics">
        <article className="doctor-stat-card">
          <div className="doctor-stat-icon teal"><FaCalendarAlt /></div>
          <div><strong>{todayAppointments.length}</strong><span>Today&apos;s Appointments</span><small>{todayAppointments.filter((item) => item.status !== "Completed").length} remaining</small></div>
        </article>
        <article className="doctor-stat-card">
          <div className="doctor-stat-icon blue"><FaClock /></div>
          <div><strong>{upcomingAppointments.length}</strong><span>Upcoming Appointments</span><small>Scheduled after today</small></div>
        </article>
        <article className="doctor-stat-card">
          <div className="doctor-stat-icon orange"><FaUserFriends /></div>
          <div><strong>{doctorPatients.length}</strong><span>Total Patients</span><small>{patientError ? "Unavailable" : "In your patient directory"}</small></div>
        </article>
        <article className="doctor-stat-card">
          <div className="doctor-stat-icon purple"><FaCheck /></div>
          <div><strong>{completedAppointments.length}</strong><span>Completed Appointments</span><small>Recorded visits</small></div>
        </article>
      </section>

      <section className="doctor-dashboard-grid">
        <div className="doctor-dashboard-main-column">
          <article className="doctor-dashboard-card">
            <div className="doctor-card-header">
              <div><span>Today&apos;s Schedule</span><h3>Appointments</h3></div>
              <button type="button" onClick={() => navigate("/doctor-schedule")}>View schedule <FaChevronRight /></button>
            </div>
            <div className="doctor-schedule-list">
              <div className="doctor-schedule-head" aria-hidden="true"><span>Time</span><span>Patient</span><span>Dental Service</span><span>Status</span></div>
              {todayAppointments.map((appointment) => (
                <div className="doctor-schedule-row" key={appointment.id}>
                  <div className="doctor-schedule-time"><FaClock /><strong>{appointment.time}</strong></div>
                  <div className="doctor-schedule-patient">
                    <div>{appointment.patient.split(" ").map((name) => name[0]).join("").slice(0, 2)}</div>
                    <span><strong>{appointment.patient}</strong><small>{appointment.patientId}</small></span>
                  </div>
                  <div className="doctor-schedule-service"><strong>{appointment.treatment}</strong></div>
                  <span className={`doctor-schedule-status ${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                  <button type="button" aria-label={`View ${appointment.patient}`} onClick={() => setSelectedAppointment(appointment)}><FaChevronRight /></button>
                </div>
              ))}
              {!todayAppointments.length && <p className="doctor-dashboard-empty">No appointments scheduled for today.</p>}
            </div>
          </article>

          <article className="doctor-dashboard-card">
            <div className="doctor-card-header">
              <div><span>Clinical Activity</span><h3>Recent Patient Records</h3></div>
              <button type="button" onClick={() => navigate("/doctor-patient-records")}>View all <FaChevronRight /></button>
            </div>
            <div className="doctor-record-list">
              {recentRecords.map((record) => (
                <div className="doctor-record-row" key={record.patientId}>
                  <div className="doctor-record-icon"><FaTooth /></div>
                  <div><strong>{record.name}</strong><span>{record.patientId}</span></div>
                  <div><strong>{record.lastTreatment}</strong><span>{formatDate(record.lastVisit)}</span></div>
                  <button type="button" onClick={() => viewPatientRecord(record.patientId)}>View</button>
                </div>
              ))}
              {!recentRecords.length && <p className="doctor-dashboard-empty">{patientError || "No recent patient records."}</p>}
            </div>
          </article>
        </div>

        <aside className="doctor-dashboard-side-column">
          <article className="doctor-dashboard-card">
            <div className="doctor-card-header">
              <div><span>Professional Profile</span><h3>Doctor Information</h3></div>
              <button type="button" onClick={() => navigate("/doctor-profile")}>Profile <FaChevronRight /></button>
            </div>
            <div className="doctor-profile-info">
              <div><span>Doctor ID</span><strong>{doctorProfile?.doctorId || "Not available"}</strong></div>
              <div><span>Professional Title</span><strong>{doctorProfile?.professionalTitle || "Not provided"}</strong></div>
              <div><span>Specialization</span><strong>{doctorProfile?.specialization || "Not provided"}</strong></div>
            </div>
          </article>

          <article className="doctor-dashboard-reminder">
            <FaCalendarAlt />
            <div>
              <strong>Appointment reminder</strong>
              <p>{nextAppointment ? `Next appointment: ${formatDate(nextAppointment.date, { day:"numeric", month:"long" })} at ${nextAppointment.time}.` : "No upcoming appointments."}</p>
            </div>
          </article>
        </aside>
      </section>

      {selectedAppointment && (
        <DashboardAppointmentModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onViewPatientRecord={() => viewPatientRecord(selectedAppointment.patientId, selectedAppointment.appointmentId)}
        />
      )}
    </DoctorLayout>
  );
}

function DashboardAppointmentModal({ appointment, onClose, onViewPatientRecord }) {
  return (
    <div className="doctor-dashboard-modal-overlay" onMouseDown={onClose}>
      <section className="doctor-dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-appointment-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><FaCalendarAlt /></div>
          <span><small>Today&apos;s Schedule</small><h2 id="dashboard-appointment-title">Appointment Details</h2></span>
          <button type="button" onClick={onClose} aria-label="Close appointment details"><FaTimes /></button>
        </header>
        <div className="doctor-dashboard-modal-patient">
          <div>{appointment.patient.split(" ").map((name) => name[0]).join("").slice(0, 2)}</div>
          <p><span>Patient</span><strong>{appointment.patient}</strong><small>{appointment.patientId}</small></p>
          <span className={`status ${appointment.status.toLowerCase()}`}>{appointment.status}</span>
        </div>
        <div className="doctor-dashboard-modal-grid">
          <div><span>Appointment ID</span><strong>{appointment.appointmentId}</strong></div>
          <div><span>Treatment</span><strong>{appointment.treatment}</strong></div>
          <div><span>Date</span><strong>{appointment.formattedDate}</strong></div>
          <div><span>Time</span><strong>{appointment.time}</strong></div>
          <div><span>Doctor</span><strong>{appointment.doctor}</strong></div>
          <div><span>Patient Note</span><strong>{appointment.note || "No note provided."}</strong></div>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Close</button>
          <button type="button" className="primary" onClick={onViewPatientRecord}><FaClipboardList /> View Patient Record</button>
        </footer>
      </section>
    </div>
  );
}

export default DoctorDashboard;
