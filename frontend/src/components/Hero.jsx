import "../styles/Hero.css";
import { lazy, Suspense } from "react";

import {
  FaCalendarAlt,
  FaLock,
  FaBell,
  FaShieldAlt,
  FaWhatsapp,
} from "react-icons/fa";
import { useClinicOperations } from "../context/useClinicOperations";
import { buildWhatsAppBookingUrl } from "../utils/whatsappBooking";
const ToothHeroVisual = lazy(() => import("./ToothHeroVisual"));


function Hero({ onBookAppointment }) {
  const { clinicInfo } = useClinicOperations();
  const whatsappUrl = buildWhatsAppBookingUrl(clinicInfo);
  return (
    <section className="hero" id="home">
      <div className="container hero-container">
        <div className="hero-left">
          <div className="hero-badge">
            <FaShieldAlt />
            <span>Secure Dental Patient Portal</span>
          </div>

          <h1>
            <span className="hero-title-line hero-title-white">SECURE WEB-BASED</span>
            <span className="hero-title-line hero-title-accent">Dental Clinic System and</span>
            <span className="hero-title-line hero-title-accent">Patient Management System</span>
          </h1>

          <p className="hero-description">
            Your healthier, more confident smile starts here. Experience comfortable dental care with easy online booking at Klinik Pergigian Rosni Adam.
          </p>

          <div className="hero-buttons">
            <button className="hero-primary-btn" onClick={onBookAppointment}>
              <FaCalendarAlt />
              Book Appointment
            </button>

            <button className="hero-secondary-btn hero-whatsapp-btn" type="button" onClick={() => { if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer"); }} aria-disabled={!whatsappUrl}>
              <FaWhatsapp />
              Book via WhatsApp
            </button>
          </div>

          <div className="hero-trust-list">
            <div>
              <FaLock />
              <span>Secure patient information</span>
            </div>

            <div>
              <FaCalendarAlt />
              <span>Online appointment booking</span>
            </div>

            <div>
              <FaBell />
              <span>Automated email reminders</span>
            </div>
          </div>
        </div>

        <div className="hero-right"><Suspense fallback={<div className="tooth-hero-loading" role="status" aria-label="Loading animated tooth" />}><ToothHeroVisual /></Suspense></div>
      </div>
    </section>
  );
}

export default Hero;
