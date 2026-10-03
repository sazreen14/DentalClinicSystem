import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TbMessageCircle, TbScan, TbBrush, TbDentalOff, TbDental } from "react-icons/tb";

import {
  FaCalendarAlt,
  FaClipboardList,
  FaBell,
  FaClock,
  FaMapMarkerAlt,
  FaChevronRight,
  FaCheck,
  FaUser,
  FaExclamationCircle,
} from "react-icons/fa";

import PatientLayout from "../components/patient/PatientLayout";
import AppointmentModal from "../components/modals/AppointmentModal";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";
import { useAuth } from "../context/useAuth";
import { useNotifications } from "../context/useNotifications";
import { getPatientRecord } from "../services/clinicalRecordsApi";

import "../styles/PatientDashboard.css";

const serviceIcons = {
  "Dental Consultation": TbMessageCircle,
  "Dental X-Ray": TbScan,
  "Scaling & Polishing": TbBrush,
  "Tooth Extraction": TbDentalOff,
  "Tooth Filling": TbDental,
};

function PatientDashboard() {
  const navigate = useNavigate();
  const { appointments, loading: appointmentsLoading, error: appointmentsError, cancelAppointment } = useAppointments();
  const { patients, loading: identityLoading, error: identityError } = useIdentity();
  const { user } = useAuth();
  const { getUnreadCount } = useNotifications();
  const currentPatient = user?.patientId ? patients.find((patient) => patient.patientId === user.patientId) : null;
  const [clinicalRecord, setClinicalRecord] = useState(null);
  const [clinicalLoading, setClinicalLoading] = useState(true);
  const [clinicalError, setClinicalError] = useState("");

  const [showAppointmentModal, setShowAppointmentModal] =
    useState(false);
  useEffect(() => {
    let active = true;
    getPatientRecord().then((record) => { if (active) setClinicalRecord(record); })
      .catch((error) => { if (active) setClinicalError(error.message); })
      .finally(() => { if (active) setClinicalLoading(false); });
    return () => { active = false; };
  }, []);

  if (identityLoading) return <PatientLayout activePage="overview" pageTitle="Overview"><section role="status" className="patient-figma-card"><p>Loading your patient profile…</p></section></PatientLayout>;
  if (!currentPatient) {
    return <PatientLayout activePage="overview" pageTitle="Overview"><section role="alert" className="patient-figma-card"><h2>Patient profile unavailable</h2><p>{identityError || "Your authenticated patient profile could not be loaded."}</p></section></PatientLayout>;
  }

  const patientAppointments = appointments;
  const completedAppointments = patientAppointments.filter((item) => item.status === "Completed");
  const recentVisits = [...completedAppointments].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 3).map((visit) => ({
    id: visit.id,
    service: visit.service,
    date: new Date(`${visit.date}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }),
    doctor: visit.doctorName,
    status: visit.status,
  }));
  const nextSharedAppointment = patientAppointments.filter((item) => item.date >= APPOINTMENT_REFERENCE_DATE && !["Cancelled", "Completed"].includes(item.status)).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const nextAppointment = nextSharedAppointment ? { ...nextSharedAppointment, doctor:nextSharedAppointment.doctorName, date:new Date(`${nextSharedAppointment.date}T00:00:00`).toLocaleDateString("en-MY", { weekday:"long", day:"numeric", month:"long", year:"numeric" }), location:"Klinik Pergigian Rosni Adam" } : null;

  const ServiceIcon = serviceIcons[nextAppointment?.service] || TbDental;

  function openAppointmentModal() {
    setShowAppointmentModal(true);
  }

  function rescheduleNextAppointment() {
    window.alert("Please contact the clinic to request an appointment reschedule.");
  }

  function cancelNextAppointment() {
    const reason = window.prompt(
      "Please enter a reason for cancelling this appointment:"
    );
    if (!reason?.trim()) return;

    cancelAppointment(nextSharedAppointment.id, { reason:reason.trim() });
  }

  return (
    <PatientLayout
      activePage="overview"
      pageTitle="Overview"
      pageSubtitle="Patient Portal · Klinik Pergigian Rosni Adam"
      patientName={currentPatient.fullName}
      patientId={`Patient ID: ${currentPatient.patientId}`}
      patientInitials={currentPatient.initials}
    >
      <section className="patient-figma-welcome">
        <div>
          <span>Good evening 👋</span>

          <h2>{currentPatient.fullName}</h2>

          <p>
            Patient ID: {currentPatient.patientId} · Member since {new Date(`${currentPatient.registrationDate}T00:00:00`).toLocaleDateString("en-MY", { month:"long", year:"numeric" })}
          </p>
        </div>

        <button
          type="button"
          onClick={openAppointmentModal}
        >
          <span>＋</span>
          Book Appointment
        </button>
      </section>

      <section className="patient-figma-stat-grid">
        <article className="patient-figma-stat-card">
          <div className="patient-figma-stat-icon teal">
            <FaCalendarAlt />
          </div>

          <div>
            <strong>{appointmentsLoading || appointmentsError ? "—" : completedAppointments.length}</strong>
            <span>Total Visits</span>
            <small>Completed visits</small>
          </div>
        </article>

        <article className="patient-figma-stat-card">
          <div className="patient-figma-stat-icon blue">
            <FaClock />
          </div>

          <div>
            <strong>{patientAppointments.filter((item) => item.date >= APPOINTMENT_REFERENCE_DATE && !["Completed", "Cancelled"].includes(item.status)).length}</strong>
            <span>Upcoming</span>
            <small>{nextSharedAppointment ? `Next: ${new Date(`${nextSharedAppointment.date}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"short" })}` : "No upcoming visit"}</small>
          </div>
        </article>

        <article className="patient-figma-stat-card">
          <div className="patient-figma-stat-icon purple">
            <FaClipboardList />
          </div>

          <div>
            <strong>{clinicalLoading ? "—" : clinicalError ? "—" : (clinicalRecord?.treatments || []).length}</strong>
            <span>Records</span>
            <small>{clinicalError ? "Unavailable" : "Clinical documents"}</small>
          </div>
        </article>

        <article className="patient-figma-stat-card">
          <div className="patient-figma-stat-icon orange">
            <FaBell />
          </div>

          <div>
            <strong>{getUnreadCount("Patient")}</strong>
            <span>Unread Alerts</span>
            <small>Notifications</small>
          </div>
        </article>
      </section>

      <section className="patient-figma-dashboard-grid">
        <div className="patient-figma-left-column">
          <article className="patient-figma-card">
            <div className="patient-figma-card-header">
              <h3>Next Appointment</h3>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-appointments")
                }
              >
                All appointments
                <FaChevronRight />
              </button>
            </div>

            {nextAppointment ? <div className="patient-figma-next-appointment">
              <div className="patient-figma-treatment-icon">
                <ServiceIcon size="1em" strokeWidth={1.75} style={{ color: "var(--public-accent-strong, var(--accent, #128f92))", verticalAlign: "top" }} aria-hidden="true" />
              </div>

              <div className="patient-figma-appointment-main">
                <div className="patient-figma-appointment-title-row">
                  <div>
                    <h4>{nextAppointment.service}</h4>
                    <span>{nextAppointment.doctor}</span>
                  </div>

                  <span
                    className={`patient-figma-confirmed ${nextAppointment.status.toLowerCase()}`}
                  >
                    {nextAppointment.status}
                  </span>
                </div>

                <div className="patient-figma-appointment-meta">
                  <span>
                    <FaCalendarAlt />
                    {nextAppointment.date}
                  </span>

                  <span>
                    <FaClock />
                    {nextAppointment.time}
                  </span>

                  <span>
                    <FaMapMarkerAlt />
                    {nextAppointment.location}
                  </span>
                </div>

                <div className="patient-figma-appointment-actions">
                  {nextAppointment.status !== "Cancelled" && (
                    <>
                      <button
                        type="button"
                        onClick={rescheduleNextAppointment}
                      >
                        Reschedule
                      </button>

                      <button
                        type="button"
                        className="cancel"
                        onClick={cancelNextAppointment}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div> : <p>No upcoming appointment</p>}
          </article>

          <article className="patient-figma-card">
            <div className="patient-figma-card-header">
              <h3>Recent Visits</h3>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-appointments", { state: { tab: "completed" } })
                }
              >
                View all
                <FaChevronRight />
              </button>
            </div>

            <div className="patient-figma-visit-list">
              {appointmentsLoading && <p role="status">Loading recent clinical activity…</p>}
              {!appointmentsLoading && appointmentsError && <p role="alert">Recent clinical activity is unavailable.</p>}
              {!appointmentsLoading && !appointmentsError && recentVisits.map((visit) => (
                <div
                  className="patient-figma-visit-row"
                  key={visit.id}
                >
                  <div className="patient-figma-visit-icon">
                    <FaCheck />
                  </div>

                  <div>
                    <strong>{visit.service}</strong>

                    <span>
                      {visit.date} · {visit.doctor}
                    </span>
                  </div>

                  <span className="patient-figma-completed">
                    {visit.status}
                  </span>
                </div>
              ))}
              {!appointmentsLoading && !appointmentsError && !recentVisits.length && <p>No clinical visits recorded yet.</p>}
            </div>
          </article>
        </div>

        <aside className="patient-figma-right-column">
          <article className="patient-figma-card">
            <div className="patient-figma-card-header">
              <h3>Patient Info</h3>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-profile")
                }
              >
                Edit
                <FaChevronRight />
              </button>
            </div>

            <div className="patient-figma-info-list">
              <div>
                <span>Blood Type</span>
                <strong>Not available</strong>
              </div>

              <div>
                <span>Date of Birth</span>
                <strong>{new Date(`${currentPatient.dateOfBirth}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" })}</strong>
              </div>

              <div>
                <span>Allergies</span>
                <strong className="danger">
                  {clinicalRecord?.allergies || "Not recorded"}
                </strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{currentPatient.phone}</strong>
              </div>
            </div>
          </article>

          <article className="patient-figma-card">
            <div className="patient-figma-card-header">
              <h3>Quick Actions</h3>
            </div>

            <div className="patient-figma-quick-list">
              <button
                type="button"
                onClick={openAppointmentModal}
              >
                <FaCalendarAlt />
                <span>Book Appointment</span>
                <FaChevronRight />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-records")
                }
              >
                <FaClipboardList />
                <span>View Records</span>
                <FaChevronRight />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-notifications")
                }
              >
                <FaBell />
                <span>Notifications</span>
                <FaChevronRight />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/patient-profile")
                }
              >
                <FaUser />
                <span>Edit Profile</span>
                <FaChevronRight />
              </button>
            </div>
          </article>

          <article className="patient-figma-notice">
            <FaExclamationCircle />

            <div>
              <strong>Appointment reminder</strong>
              <p>
                {nextSharedAppointment
                  ? `Your next appointment is scheduled for ${nextAppointment.date} at ${nextAppointment.time}.`
                  : "You do not have an upcoming appointment."}
              </p>
            </div>
          </article>
        </aside>
      </section>

      {showAppointmentModal && (
        <AppointmentModal
          onClose={() =>
            setShowAppointmentModal(false)
          }
        />
      )}
      {appointmentsLoading && <span className="sr-only" role="status">Loading appointments</span>}
      {appointmentsError && <span className="sr-only" role="alert">{appointmentsError}</span>}
    </PatientLayout>
  );
}

export default PatientDashboard;
