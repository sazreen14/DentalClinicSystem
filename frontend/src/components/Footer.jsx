import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaClock, FaFacebookF, FaInstagram, FaShieldAlt } from "react-icons/fa";
import { formatClinicTime, groupOperatingHours, useClinicOperations } from "../context/useClinicOperations";
import "../styles/Footer.css";
import TermsOfUseModal from "./modals/TermsOfUseModal";

function Footer({ onLogin, onRegister, onBookAppointment }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const { clinicInfo, operatingHours } = useClinicOperations();
  const primaryHours = groupOperatingHours(operatingHours)[0];
  const phoneHref = `tel:${clinicInfo.phone.replace(/\D/g, "")}`;
  const hoursLabel = primaryHours
    ? `${primaryHours.label}: ${primaryHours.open ? `${formatClinicTime(primaryHours.start)} – ${formatClinicTime(primaryHours.end)}` : "Closed"}`
    : "Operating hours loading";

  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand-column">
          <div className="footer-brand-heading"><div className="footer-logo"><img src="/clinic-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit", display: "block" }} /></div><div><h2>{clinicInfo.clinicName}</h2><span>Dental Clinic</span></div></div>
          <p className="footer-description">A secure, PDPA-compliant digital patient management system for modern dental care.</p>
          <div className="footer-socials"><a href="https://www.facebook.com/klinikpergigianrosni/" target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF /></a><a href="https://www.instagram.com/klinikpergigianrosniadam?stkn=MWJ5aXMyYTRyank2eg==" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FaInstagram /></a></div>
        </div>

        <div className="footer-column"><h3>Navigation</h3><a href="#home">Home</a><a href="#about">About Clinic</a><a href="#services">Services</a><a href="#location">Clinic Location</a><a href="#reviews">Patient Reviews</a></div>

        <div className="footer-column">
          <h3>Patient Portal</h3><button type="button" onClick={onLogin}>Login to Portal</button><button type="button" onClick={onRegister}>Create Account</button><button type="button" onClick={onBookAppointment}>Book Appointment</button><a href="#privacy" aria-haspopup="dialog" onClick={(event) => { event.preventDefault(); setPrivacyOpen(true); }}>Privacy Policy</a><a href="#terms" aria-haspopup="dialog" onClick={(event) => { event.preventDefault(); setTermsOpen(true); }}>Terms of Use</a></div>

        <div className="footer-column footer-contact-column">
          <h3>Contact Info</h3>
          <div className="footer-contact-item"><FaMapMarkerAlt /><span>{clinicInfo.address}</span></div>
          <a href={phoneHref} className="footer-contact-item"><FaPhoneAlt /><span>{clinicInfo.phone}</span></a>
          <a href={`mailto:${clinicInfo.email}`} className="footer-contact-item"><FaEnvelope /><span>{clinicInfo.email}</span></a>
          <div className="footer-contact-item"><FaClock /><span>{hoursLabel}</span></div>
        </div>
      </div>

      <div className="container footer-divider" />
      <div className="container footer-bottom"><p>© 2026 {clinicInfo.clinicName}. All rights reserved.</p><div className="footer-security"><FaShieldAlt /><span>PDPA Compliant · SSL Secured · v1.0</span></div></div>
      {privacyOpen && <PrivacyPolicyModal clinicInfo={clinicInfo} onClose={() => setPrivacyOpen(false)} />}
      {termsOpen && <TermsOfUseModal clinicInfo={clinicInfo} onClose={() => setTermsOpen(false)} />}
    </footer>
  );
}

export default Footer;
import { useState } from "react";
import PrivacyPolicyModal from "./modals/PrivacyPolicyModal";
