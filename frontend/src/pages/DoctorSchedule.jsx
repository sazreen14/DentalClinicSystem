import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaClock,
  FaLock,
  FaPlus,
  FaTimes,
  FaUserClock,
} from "react-icons/fa";

import DoctorLayout from "../components/doctor/DoctorLayout";
import { APPOINTMENT_REFERENCE_DATE, useAppointments } from "../context/useAppointments";
import { useIdentity } from "../context/useIdentity";

import "../styles/DoctorSchedule.css";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];

function formatShortDate(date) {
  return date.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function DoctorSchedule() {
  const navigate = useNavigate();
  const { appointments: sharedAppointments } = useAppointments();
  const { patients } = useIdentity();
  const appointments = useMemo(() => sharedAppointments.filter((item) => item.status !== "Cancelled").map((item) => ({ ...item, patient:patients.find((patient)=>patient.patientId===item.patientId)?.fullName||item.patientName, treatment:item.service, note:item.patientNote })), [sharedAppointments,patients]);
  const nextAppointment = appointments.filter((item) => item.date >= APPOINTMENT_REFERENCE_DATE && !["Completed", "Cancelled"].includes(item.status)).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState("week");
  const [selectedDayIndex, setSelectedDayIndex] = useState(5);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);

  const weekDays = useMemo(() => {
    const monday = new Date(2026, 7, 3 + weekOffset * 7);

    return dayNames.map((name, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { name, date, index };
    });
  }, [weekOffset]);

  const displayedDays = view === "day" ? [weekDays[selectedDayIndex]] : weekDays;
  const weekRange = `${formatShortDate(weekDays[0].date)} – ${formatShortDate(weekDays[5].date)} ${weekDays[5].date.getFullYear()}`;

  function getAppointmentDetails(appointment) {
    const appointmentDate = new Date(`${appointment.date}T00:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
    return { ...appointment, date: appointmentDate };
  }

  function viewPatientRecord(appointment) {
    navigate("/doctor-patient-records", { state: { patientId: appointment.patientId, appointmentId: appointment.id, from: "/doctor-schedule" } });
  }

  function toggleBlockedSlot(day, time) {
    const key = `${weekOffset}-${day}-${time}`;
    setBlockedSlots((previous) =>
      previous.includes(key) ? previous.filter((slot) => slot !== key) : [...previous, key]
    );
  }

  return (
    <DoctorLayout
      activePage="schedule"
      pageTitle="Schedule"
      pageSubtitle="Manage your daily and weekly appointment schedule"
      doctorName="Dr. Rosni Adam"
      doctorInitials="RA"
    >
      <section className="doctor-schedule-heading">
        <div>
          <span>Calendar Management</span>
          <h2>Schedule</h2>
          <p>Manage your daily and weekly appointment schedule.</p>
        </div>
        <div className="doctor-schedule-heading-icon" aria-hidden="true"><FaCalendarAlt /></div>
      </section>

      <section className="doctor-schedule-controls">
        <div className="doctor-schedule-navigation">
          <button type="button" className="today" onClick={() => { setWeekOffset(0); setSelectedDayIndex(5); }}>Today</button>
          <button type="button" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Previous week"><FaChevronLeft /></button>
          <strong>{weekRange}</strong>
          <button type="button" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Next week"><FaChevronRight /></button>
        </div>
        <div className="doctor-schedule-view-toggle" role="tablist" aria-label="Schedule view">
          <button type="button" role="tab" aria-selected={view === "day"} className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Day</button>
          <button type="button" role="tab" aria-selected={view === "week"} className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
        </div>
      </section>

      <section className="doctor-schedule-summary" aria-label="Schedule summary">
        <article><div className="teal"><FaCalendarAlt /></div><p><strong>4</strong><span>Today&apos;s Appointments</span><small>Saturday, 8 August</small></p></article>
        <article><div className="blue"><FaUserClock /></div><p><strong>5</strong><span>Available Slots</span><small>Open today</small></p></article>
        <article><div className="purple"><FaCheckCircle /></div><p><strong>1</strong><span>Completed Today</span><small>3 remaining</small></p></article>
        <article><div className="orange"><FaClock /></div><p><strong>4</strong><span>Pending Appointments</span><small>Awaiting confirmation</small></p></article>
      </section>

      <section className="doctor-schedule-layout">
        <article className="doctor-calendar-card">
          <div className="doctor-calendar-card-heading">
            <div><span>{view === "week" ? "Weekly Calendar" : "Daily Calendar"}</span><h3>{view === "week" ? "Clinic Schedule" : `${weekDays[selectedDayIndex].name} Schedule`}</h3></div>
            <p>Sunday closed</p>
          </div>

          <div className={`doctor-calendar-scroll ${view === "day" ? "day-view" : ""}`}>
            <div className="doctor-calendar-grid" style={{ "--day-count": displayedDays.length }}>
              <div className="doctor-calendar-corner">Time</div>
              {displayedDays.map((day) => (
                <div className="doctor-calendar-day" key={day.name}>
                  <strong>{day.name}</strong><span>{formatShortDate(day.date)}</span>
                </div>
              ))}

              {timeSlots.map((time) => (
                <div className="doctor-calendar-row" key={time}>
                  <div className="doctor-calendar-time">{time}</div>
                  {displayedDays.map((day) => {
                    const dateKey = day.date.toLocaleDateString("en-CA");
                    const appointment = appointments.find((item) => item.date === dateKey && item.time === time);
                    const isClosed = day.index === 5 && time === "6:00 PM";
                    const blockKey = `${weekOffset}-${day.index}-${time}`;
                    const isBlocked = blockedSlots.includes(blockKey);

                    return (
                      <div className={`doctor-calendar-slot ${isClosed ? "closed" : ""}`} key={`${day.name}-${time}`}>
                        {appointment ? (
                          <button type="button" className={`doctor-calendar-appointment ${appointment.status.toLowerCase()}`} onClick={() => setSelectedAppointment(getAppointmentDetails(appointment))}>
                            <strong>{appointment.patient}</strong>
                            <span>{appointment.treatment}</span>
                            <small>{appointment.time} · {appointment.status}</small>
                          </button>
                        ) : isClosed ? (
                          <span className="doctor-calendar-closed">Closed</span>
                        ) : isBlocked ? (
                          <button type="button" className="doctor-calendar-blocked" onClick={() => toggleBlockedSlot(day.index, time)}><FaLock /> Blocked</button>
                        ) : (
                          <button type="button" className="doctor-calendar-empty" onClick={() => toggleBlockedSlot(day.index, time)} aria-label={`Block ${day.name} at ${time}`}><FaPlus /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="doctor-schedule-side">
          <article className="doctor-schedule-side-card">
            <div className="doctor-schedule-side-heading"><span>Today</span><h3>Today&apos;s Schedule</h3></div>
            <div className="doctor-today-list">
              {appointments.filter((item) => item.date === weekDays[selectedDayIndex].date.toLocaleDateString("en-CA")).map((appointment) => (
                <button type="button" key={appointment.id} onClick={() => setSelectedAppointment(getAppointmentDetails(appointment))}>
                  <time>{appointment.time}</time><p><strong>{appointment.patient}</strong><span>{appointment.treatment}</span></p><FaChevronRight />
                </button>
              ))}
            </div>
          </article>

          <article className="doctor-schedule-side-card doctor-next-appointment">
            <div className="doctor-schedule-side-heading"><span>Coming Up</span><h3>Next Appointment</h3></div>
            {nextAppointment && <><div className="doctor-next-content"><div>{nextAppointment.patient.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><p><strong>{nextAppointment.patient}</strong><span>{nextAppointment.treatment}</span><small><FaClock /> {nextAppointment.time}</small></p></div>
            <div className="doctor-next-actions"><button type="button" onClick={() => viewPatientRecord(nextAppointment)}><FaClipboardList /> Record</button></div></>}
          </article>

          <article className="doctor-schedule-side-card">
            <div className="doctor-schedule-side-heading"><span>Open Today</span><h3>Available Time Slots</h3></div>
            <div className="doctor-available-slots">{["10:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "4:00 PM"].map((time) => <span key={time}>{time}</span>)}</div>
            <button type="button" className="doctor-block-slot-action" onClick={() => toggleBlockedSlot(5, "4:00 PM")}><FaLock /> Block Time Slot</button>
          </article>

          <article className="doctor-schedule-side-card">
            <div className="doctor-schedule-side-heading"><span>Clinic Information</span><h3>Operating Hours</h3></div>
            <div className="doctor-hours-list"><p><span>Monday – Friday</span><strong>9:00 AM – 6:00 PM</strong></p><p><span>Saturday</span><strong>9:00 AM – 5:00 PM</strong></p><p className="closed"><span>Sunday</span><strong>Closed</strong></p></div>
          </article>
        </aside>
      </section>
      {selectedAppointment && <ScheduleAppointmentModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onViewPatientRecord={() => viewPatientRecord(selectedAppointment)} />}
    </DoctorLayout>
  );
}

function ScheduleAppointmentModal({ appointment, onClose, onViewPatientRecord }) {
  return (
    <div className="doctor-schedule-modal-overlay" onMouseDown={onClose}>
      <section className="doctor-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-appointment-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><FaCalendarAlt /></div><span><small>Scheduled Visit</small><h2 id="schedule-appointment-title">Appointment Details</h2></span><button type="button" onClick={onClose} aria-label="Close appointment details"><FaTimes /></button></header>
        <div className="doctor-schedule-modal-patient"><div>{appointment.patient.split(" ").map((name) => name[0]).join("").slice(0,2)}</div><p><span>Patient</span><strong>{appointment.patient}</strong><small>{appointment.patientId}</small></p><span className={`status ${appointment.status.toLowerCase()}`}>{appointment.status}</span></div>
        <div className="doctor-schedule-modal-grid"><div><span>Treatment</span><strong>{appointment.treatment}</strong></div><div><span>Date</span><strong>{appointment.date}</strong></div><div><span>Time</span><strong>{appointment.time}</strong></div><div><span>Doctor</span><strong>{appointment.doctorName}</strong></div></div>
        <footer><button type="button" onClick={onClose}>Close</button><button type="button" className="primary" onClick={onViewPatientRecord}><FaClipboardList /> View Patient Record</button></footer>
      </section>
    </div>
  );
}

export default DoctorSchedule;
