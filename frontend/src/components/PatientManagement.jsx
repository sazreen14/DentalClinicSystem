import { lazy, Suspense, useEffect, useRef } from "react";
import { FaBell, FaCalendarAlt, FaClipboardList, FaShieldAlt, FaUserPlus, FaWhatsapp } from "react-icons/fa";
import { useClinicOperations } from "../context/useClinicOperations";
import { buildWhatsAppBookingUrl } from "../utils/whatsappBooking";
import "../styles/PatientManagement.css";

const PatientManagementTooth = lazy(() => import("./PatientManagementTooth"));

const managementFeatures = [
  { icon: <FaCalendarAlt />, title: "Online Booking", description: "Book, reschedule, or cancel appointments with real-time availability." },
  { icon: <FaClipboardList />, title: "Patient Records", description: "Access secure digital records and previous treatment information." },
  { icon: <FaBell />, title: "Email Reminders", description: "Receive appointment confirmations and automated reminder emails." },
  { icon: <FaShieldAlt />, title: "Data Security", description: "Patient information is protected through secure handling." },
];

function PatientManagement({ onRegister }) {
  const sectionRef = useRef(null);
  const { clinicInfo } = useClinicOperations();
  const whatsappUrl = buildWhatsAppBookingUrl(clinicInfo);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const elements = [...section.querySelectorAll("[data-management-reveal]")];
    section.classList.add("patient-management-motion-ready");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-revealed"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); observer.unobserve(entry.target); } }), { threshold: .18, rootMargin: "0px 0px -8% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <section className="patient-management-section" ref={sectionRef}>
    <div className="container patient-management-container">
      <div className="patient-management-intro">
        <div className="patient-management-heading" data-management-reveal style={{ "--management-delay": "0ms" }}><span>Patient Management System</span><h2>Everything you need,<br/><em>online.</em></h2><p>A secure digital platform connecting patients and clinic services for a more convenient dental care experience.</p></div>
        <div className="patient-management-visual" data-management-reveal style={{ "--management-delay": "120ms" }}>
          <div className="patient-management-halo" aria-hidden="true" />
          <Suspense fallback={<div className="patient-management-tooth-loading" aria-hidden="true" />}><PatientManagementTooth /></Suspense>
          <div className="patient-management-platform" aria-hidden="true"><i/></div>
        </div>
      </div>

      <div className="patient-management-grid">{managementFeatures.map((feature, index) => <article className="patient-management-card" data-management-reveal style={{ "--management-delay": `${220 + index * 90}ms` }} key={feature.title}><div className="patient-management-icon">{feature.icon}</div><h3>{feature.title}</h3><p>{feature.description}</p><i className="patient-management-card-accent" aria-hidden="true" /></article>)}</div>

      <div className="patient-management-actions patient-management-choices">
        <div className="patient-management-choice patient-management-account" data-management-reveal style={{ "--management-delay": "620ms" }}><div className="patient-management-choice-heading"><span className="patient-management-choice-icon"><FaUserPlus/></span><div><strong>Create Patient Account</strong><span>Manage appointments and access your patient portal.</span></div></div><button type="button" className="patient-management-primary" onClick={onRegister}><FaUserPlus/> Create Patient Account</button><small>Secure online registration and patient access.</small></div>
        <div className="patient-management-choice patient-management-whatsapp" data-management-reveal style={{ "--management-delay": "720ms" }}><div className="patient-management-choice-heading"><span className="patient-management-choice-icon"><FaWhatsapp/></span><div><strong>Quick booking or enquiry</strong><span>No account needed. Contact the clinic directly.</span></div></div><a className={`patient-management-secondary whatsapp-booking ${whatsappUrl ? "" : "disabled"}`} href={whatsappUrl || undefined} target={whatsappUrl ? "_blank" : undefined} rel={whatsappUrl ? "noreferrer" : undefined} aria-disabled={!whatsappUrl} onClick={(event) => { if (!whatsappUrl) event.preventDefault(); }}><FaWhatsapp /> Book via WhatsApp</a><small>Appointment is subject to clinic confirmation.</small></div>
      </div>
    </div>
  </section>;
}

export default PatientManagement;
