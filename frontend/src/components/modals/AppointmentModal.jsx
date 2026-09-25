import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaBell,
} from "react-icons/fa";

import "../../styles/AppointmentModal.css";
import "../../styles/AppointmentSuccess.css";
import { useClinicOperations } from "../../context/useClinicOperations";
import { useAppointments } from "../../context/useAppointments";
import { sameDayAvailabilityAdjustment } from "../../utils/appointmentDateAvailability";

const serviceIcons = { scaling:"🪥", filling:"🦷", extraction:"🔬", braces:"😁", whitening:"✨", consultation:"📋", xray:"💀", implant:"⚙️", followup:"🗓️", general:"🦷" };

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const displayDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-MY", { day:"numeric", month:"long", year:"numeric" }) : "—";
const displayTime = value => value ? new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-MY", { hour:"numeric", minute:"2-digit" }) : "—";

function AppointmentModal({ onClose }) {
  const { clinicInfo } = useClinicOperations();
  const { addAppointment, getBookingOptions, getAvailability } = useAppointments();
  const [services,setServices]=useState([]),[doctors,setDoctors]=useState([]),[availableTimeSlots,setAvailableTimeSlots]=useState([]),[submitError,setSubmitError]=useState('');
  const today = new Date();

  const [step, setStep] = useState(1);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [closureMessage, setClosureMessage] = useState("");
  const [minimumSelectableDate,setMinimumSelectableDate]=useState("");

  const [calendarDate, setCalendarDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [formData, setFormData] = useState({
    service: null,
    doctor: null,
    date: "",
    time: "",
    fullName: "",
    icNumber: "",
    phone: "",
    email: "",
    notes: "",
  });

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(day);
    }

    return days;
  }, [calendarDate]);

  useEffect(()=>{getBookingOptions().then(data=>{setServices((data.services||[]).map(s=>({...s,durationMinutes:Number(s.durationMinutes)})));setDoctors(data.doctors||[]);}).catch(error=>setSubmitError(error.message));},[getBookingOptions]);
  useEffect(()=>{queueMicrotask(()=>{if(!formData.date||!formData.service||!formData.doctor){setAvailableTimeSlots([]);return;}getAvailability({doctorId:formData.doctor.id,date:formData.date,serviceId:formData.service.id}).then(data=>{const slots=data.slots||[],adjustment=sameDayAvailabilityAdjustment(formData.date,data,minimumSelectableDate);setAvailableTimeSlots(slots);setClosureMessage(adjustment.message||(!slots.length?'No appointment slots are available on this date.':''));if(adjustment.clearSelectedDate){setMinimumSelectableDate(adjustment.minimumDate);setFormData(previous=>({...previous,date:'',time:''}));}}).catch(error=>{setAvailableTimeSlots([]);setClosureMessage(error.message);});});},[formData.date,formData.doctor,formData.service,getAvailability,minimumSelectableDate]);

  function updateField(name, value) {
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function changeMonth(amount) {
    setCalendarDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + amount,
          1
        )
    );
  }

  function selectDate(day) {
    if (!day) return;

    const selectedDate = new Date(
      calendarDate.getFullYear(),
      calendarDate.getMonth(),
      day
    );

    const minimumDate = new Date();
    minimumDate.setHours(0, 0, 0, 0);

    if (selectedDate < minimumDate) return;

    const formattedDate = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, "0"),
      String(selectedDate.getDate()).padStart(2, "0"),
    ].join("-");

    if (minimumSelectableDate && formattedDate < minimumSelectableDate) return;

    setClosureMessage("");
    updateField("date", formattedDate);
    updateField("time", "");
  }

  function handleDetailsChange(event) {
    const { name, value } = event.target;
    updateField(name, value);
  }

  async function handleConfirm() {
    setSubmitError('');
    try { await addAppointment({dentalServiceId:formData.service.id,doctorId:formData.doctor.id,date:formData.date,time:formData.time,patientNote:formData.notes||undefined}); setBookingConfirmed(true); }
    catch(error){setSubmitError(error.message);}
  }

  const canContinueStep1 = Boolean(formData.service && services.some((service) => service.id === formData.service.id));

  const canContinueStep2 = Boolean(formData.doctor && doctors.some((doctor) => doctor.id === formData.doctor.id));

  const canContinueStep3 = Boolean(
    formData.date && availableTimeSlots.includes(formData.time)
  );

  const canContinueStep4 = Boolean(
    formData.fullName.trim() &&
      formData.icNumber.trim() &&
      formData.phone.trim() &&
      formData.email.trim()
  );

  return (
    <div className="appointment-overlay" onMouseDown={onClose}>
      <div
        className={`appointment-modal ${bookingConfirmed ? "appointment-modal-success" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="appointment-header">
          <button
            type="button"
            className="appointment-close"
            onClick={onClose}
            aria-label="Close appointment modal"
          >
            ×
          </button>

          <h2>Book Appointment</h2>

          <p>
            {clinicInfo.clinicName} · Online Booking System
          </p>

          {!bookingConfirmed && (
            <div className="appointment-progress">
              {[
                "Service",
                "Doctor",
                "Date & Time",
                "Your Details",
                "Confirm",
              ].map((label, index) => {
                const number = index + 1;
                const completed = step > number;
                const active = step === number;

                return (
                  <div className="progress-item" key={label}>
                    <div
                      className={`progress-circle ${
                        completed ? "completed" : ""
                      } ${active ? "active" : ""}`}
                    >
                      {completed ? <FaCheck /> : number}
                    </div>

                    <span
                      className={
                        active || completed
                          ? "active-label"
                          : ""
                      }
                    >
                      {label}
                    </span>

                    {number < 5 && (
                      <div className="progress-line" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </header>

        <div className="appointment-body">
          {bookingConfirmed ? (
            <section className="appointment-success">
              <div className="appointment-success-icon">
                <FaCheck />
              </div>

              <h3>Appointment Request Submitted</h3>

              <p className="appointment-success-message">
                Your appointment request has been submitted and is awaiting staff confirmation.
              </p>

              <div className="success-summary-card">
                <div className="success-summary-row">
                  <span>Doctor</span>
                  <strong>{formData.doctor?.name}</strong>
                </div>

                <div className="success-summary-row">
                  <span>Service</span>
                  <strong>{formData.service?.name}</strong>
                </div>

                <div className="success-summary-row">
                  <span>Date</span>
                  <strong>{displayDate(formData.date)}</strong>
                </div>

                <div className="success-summary-row">
                  <span>Time</span>
                  <strong>{displayTime(formData.time)}</strong>
                </div>

                <div className="success-summary-row">
                  <span>Patient</span>
                  <strong>{formData.fullName}</strong>
                </div>

              </div>

              <span className="pending-confirmation-badge">Pending Confirmation</span>

              <button
                type="button"
                className="appointment-primary-button success-close-button"
                onClick={onClose}
              >
                Close
              </button>
            </section>
          ) : (
            <>
              {step === 1 && (
                <section className="appointment-step-section">
                  <h3 className="appointment-section-title">
                    Select Service
                  </h3>

                  <div className="appointment-services-grid">
                    {services.map((service) => {
                      const selected =
                        formData.service?.name === service.name;

                      return (
                        <button
                          type="button"
                          key={service.id}
                          className={`appointment-service-card ${
                            selected ? "selected" : ""
                          }`}
                          onClick={() => setFormData((previous) => ({ ...previous, service, doctor:null, date:"", time:"" }))}
                        >
                          <span className="appointment-service-icon">
                            {serviceIcons[service.iconKey] || serviceIcons.general}
                          </span>

                          <strong>{service.name}</strong>
                          <small>{service.durationMinutes} min</small>
                        </button>
                      );
                    })}
                  </div>

                  <div className="appointment-actions align-right">
                    <button
                      type="button"
                      className="appointment-primary-button"
                      disabled={!canContinueStep1}
                      onClick={() => setStep(2)}
                    >
                      Next: Choose Doctor
                      <FaChevronRight />
                    </button>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="appointment-step-section">
                  <h3 className="appointment-section-title">Select Doctor</h3>
                  <p className="appointment-section-copy">Choose the Doctor who will provide your treatment.</p>
                  <div className="appointment-doctors-grid">
                    {doctors.map((doctor) => <button type="button" key={doctor.id} className={`appointment-doctor-card ${formData.doctor?.id === doctor.id ? "selected" : ""}`} onClick={() => setFormData((previous) => ({ ...previous, doctor, date:"", time:"" }))}>
                      <span>{doctor.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span>
                      <strong>{doctor.name}</strong>
                      <small>{doctor.professionalTitle}{doctor.specialization ? ` · ${doctor.specialization}` : ""}</small>
                    </button>)}
                  </div>
                  {!doctors.length && <p className="appointment-closed-message" role="alert">No clinic Doctors are currently available for online booking.</p>}
                  <div className="appointment-actions"><button type="button" className="appointment-back-button" onClick={() => setStep(1)}>Back</button><button type="button" className="appointment-primary-button" disabled={!canContinueStep2} onClick={() => setStep(3)}>Next: Choose Date <FaChevronRight /></button></div>
                </section>
              )}

              {step === 3 && (
                <section className="appointment-step-section">
                  <div className="date-time-layout">
                    <div>
                      <h3 className="appointment-section-title">
                        Select Date
                      </h3>

                      <div className="calendar-card">
                        <div className="calendar-header">
                          <button
                            type="button"
                            onClick={() => changeMonth(-1)}
                            aria-label="Previous month"
                          >
                            <FaChevronLeft />
                          </button>

                          <strong>
                            {monthNames[calendarDate.getMonth()]}{" "}
                            {calendarDate.getFullYear()}
                          </strong>

                          <button
                            type="button"
                            onClick={() => changeMonth(1)}
                            aria-label="Next month"
                          >
                            <FaChevronRight />
                          </button>
                        </div>

                        <div className="calendar-weekdays">
                          {[
                            "Su",
                            "Mo",
                            "Tu",
                            "We",
                            "Th",
                            "Fr",
                            "Sa",
                          ].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>

                        <div className="calendar-grid">
                          {calendarDays.map((day, index) => {
                            if (!day) {
                              return (
                                <span key={`empty-${index}`} />
                              );
                            }

                            const dateValue = `${calendarDate.getFullYear()}-${String(
                              calendarDate.getMonth() + 1
                            ).padStart(2, "0")}-${String(day).padStart(
                              2,
                              "0"
                            )}`;

                            const selected =
                              formData.date === dateValue;

                            const dateObject = new Date(
                              calendarDate.getFullYear(),
                              calendarDate.getMonth(),
                              day
                            );

                            const minimumDate = new Date();
                            minimumDate.setHours(0, 0, 0, 0);

                            const disabled =
                              dateObject < minimumDate || Boolean(minimumSelectableDate && dateValue < minimumSelectableDate);

                            return (
                              <button
                                type="button"
                                key={dateValue}
                                disabled={disabled}
                                className={
                                  selected ? "selected" : ""
                                }
                                onClick={() => selectDate(day)}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {closureMessage && (
                        <div className="appointment-closed-message" role="alert">
                          {closureMessage}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="appointment-section-title">
                        Select Time
                      </h3>

                      <div className="time-grid">
                        {availableTimeSlots.map((time) => (
                          <button
                            type="button"
                            key={time}
                            className={
                              formData.time === time
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              updateField("time", time)
                            }
                          >
                            {time}
                          </button>
                        ))}
                      </div>

                      {formData.date && (
                        <div className="selected-date-box">
                          <strong>Selected:</strong>{" "}
                          {formData.date}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="appointment-actions">
                    <button
                      type="button"
                      className="appointment-back-button"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="appointment-primary-button"
                      disabled={!canContinueStep3}
                      onClick={() => setStep(4)}
                    >
                      Next: Your Details
                      <FaChevronRight />
                    </button>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="appointment-step-section appointment-patient-information">
                  <h3 className="appointment-section-title">
                    Patient Information
                  </h3>

                  <div className="patient-details-form">
                    <label className="full-width">
                      Full Name *
                      <input
                        name="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={handleDetailsChange}
                        required
                      />
                    </label>

                    <label>
                      IC / Passport Number *
                      <input
                        name="icNumber"
                        type="text"
                        placeholder="Enter IC or passport number"
                        value={formData.icNumber}
                        onChange={handleDetailsChange}
                        required
                      />
                    </label>

                    <label>
                      Phone Number *
                      <input
                        name="phone"
                        type="tel"
                        placeholder="Example: 0192817109"
                        value={formData.phone}
                        onChange={handleDetailsChange}
                        required
                      />
                    </label>

                    <label className="full-width">
                      Email Address *
                      <input
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={handleDetailsChange}
                        required
                      />
                    </label>

                    <label className="full-width">
                      Additional Notes (optional)
                      <textarea
                        name="notes"
                        rows="4"
                        placeholder="e.g. allergies, special requirements, previous dental history..."
                        value={formData.notes}
                        onChange={handleDetailsChange}
                      />
                    </label>
                  </div>

                  <div className="appointment-actions">
                    <button
                      type="button"
                      className="appointment-back-button"
                      onClick={() => setStep(3)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="appointment-primary-button"
                      disabled={!canContinueStep4}
                      onClick={() => setStep(5)}
                    >
                      Review Booking
                      <FaChevronRight />
                    </button>
                  </div>
                </section>
              )}

              {step === 5 && (
                <section className="appointment-step-section appointment-review-step">
                  <h3 className="appointment-section-title">
                    Review & Confirm
                  </h3>

                  <div className="booking-review-grid">
                    <div className="review-panel">
                      <h4>Appointment</h4>

                      <div>
                        <span>Doctor</span>
                        <strong>{formData.doctor?.name}</strong>
                      </div>

                      <div>
                        <span>Service</span>
                        <strong>{formData.service?.name}</strong>
                      </div>

                      <div>
                        <span>Duration</span>
                        <strong>
                          {formData.service?.durationMinutes} minutes
                        </strong>
                      </div>

                      <div>
                        <span>Date</span>
                        <strong>{formData.date}</strong>
                      </div>

                      <div>
                        <span>Time</span>
                        <strong>{formData.time}</strong>
                      </div>
                    </div>

                    <div className="review-panel">
                      <h4>Patient</h4>

                      <div>
                        <span>Name</span>
                        <strong>{formData.fullName}</strong>
                      </div>

                      <div>
                        <span>IC No.</span>
                        <strong>{formData.icNumber}</strong>
                      </div>

                      <div>
                        <span>Phone</span>
                        <strong>{formData.phone}</strong>
                      </div>

                      <div>
                        <span>Email</span>
                        <strong>{formData.email}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="appointment-email-note">
                    <FaBell />

                    <p>
                      Your appointment will be submitted as pending after the clinic securely rechecks availability. Staff confirmation is required.
                    </p>
                  </div>

                  <div className="appointment-actions">
                    {submitError && <p role="alert">{submitError}</p>}
                    <button
                      type="button"
                      className="appointment-back-button"
                      onClick={() => setStep(4)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className="appointment-primary-button primary"
                      onClick={handleConfirm}
                    >
                      Confirm Appointment
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppointmentModal;
