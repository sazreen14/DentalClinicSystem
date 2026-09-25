import { lazy, Suspense } from "react";
import { FaCalendarCheck, FaClipboardCheck, FaShieldAlt, FaSmile, FaStar, FaTooth, FaUsers } from "react-icons/fa";
import clinicImage from "../assets/images/clinic.jpg";
import "../styles/About.css";

const AboutToothVisual = lazy(() => import("./AboutToothVisual"));

const clinicFeatures = [
  { icon: <FaCalendarCheck />, title: "Online Appointments", description: "Convenient access to appointment booking." },
  { icon: <FaTooth />, title: "Dental Care", description: "Patient-centred clinic services and treatment." },
  { icon: <FaShieldAlt />, title: "PDPA Compliant", description: "Patient information is handled securely." },
  { icon: <FaClipboardCheck />, title: "Secure Records", description: "Centralised and protected patient records." },
];

const clinicStats = [
  { icon: <FaUsers />, value: "10+", label: "Years of Experience" },
  { icon: <FaSmile />, value: "5,000+", label: "Happy Patients" },
  { icon: <FaShieldAlt />, value: "100%", label: "PDPA Compliant" },
  { icon: <FaStar />, value: "4.9", label: "Patient Rating" },
];

function About() {
  return <section className="about-section" id="about">
    <div className="about-orb about-orb-one" aria-hidden="true" /><div className="about-orb about-orb-two" aria-hidden="true" />
    <div className="container about-wrapper">
      <div className="about-visual">
        <img className="about-clinic-image" src={clinicImage} alt="Reception area at Klinik Pergigian Rosni Adam" />
        <div className="about-image-orbit" aria-hidden="true" />
        <div className="about-tooth-stage">
          <div className="about-tooth-platform" aria-hidden="true"><i /></div>
          <Suspense fallback={<div className="about-tooth-loading" aria-hidden="true" />}><AboutToothVisual /></Suspense>
        </div>
      </div>

      <div className="about-information">
        <span className="about-eyebrow">About the Clinic</span>
        <h2>Klinik Pergigian Rosni Adam</h2>
        <span className="about-title-line" aria-hidden="true" />
        <p>Klinik Pergigian Rosni Adam is committed to providing reliable, comfortable, and patient-centred dental care in a welcoming environment.</p>
        <p>The proposed patient portal improves access to clinic services by allowing patients to book appointments online, receive email reminders, view clinic information, and manage their dental visits through one secure platform.</p>
        <div className="about-features-grid">
          {clinicFeatures.map((feature) => <article className="about-feature-card" key={feature.title}><div className="about-feature-icon">{feature.icon}</div><div><h3>{feature.title}</h3><p>{feature.description}</p></div></article>)}
        </div>
      </div>
    </div>

    <div className="container about-stats-shell" aria-label="Clinic highlights">
      <div className="about-stats-track">
        {[0, 1].map((copy) => <div className="about-stats-set" aria-hidden={copy === 1 ? "true" : undefined} key={copy}>{clinicStats.map((stat) => <div className="about-stat" key={`${copy}-${stat.label}`}><span className="about-stat-icon">{stat.icon}</span><span><strong>{stat.value}</strong><small>{stat.label}</small></span></div>)}</div>)}
      </div>
    </div>
  </section>;
}

export default About;
