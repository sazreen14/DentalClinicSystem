import { useState } from "react";
import { useLocation } from "react-router-dom";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Services from "../components/Services";
import About from "../components/About";
import PatientManagement from "../components/PatientManagement";
import Location from "../components/Location";
import Reviews from "../components/Reviews";
import Footer from "../components/Footer";
import LoginModal from "../components/modals/LoginModal";
import RegisterModal from "../components/modals/RegisterModal";
import ForgotPasswordModal from "../components/modals/ForgotPasswordModal";
import AppointmentModal from "../components/modals/AppointmentModal";
import { useAuth } from "../context/useAuth";
import "../styles/PublicSite.css";

function Home() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeModal, setActiveModal] = useState(() => location.state?.openLogin ? "login" : null);
  const [authNotice, setAuthNotice] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");

  function openModal(modalName) {
    setVerificationEmail("");
    setAuthNotice("");
    setActiveModal(modalName);
  }

  function openBooking() {
    if (!isAuthenticated) {
      setVerificationEmail("");
      setAuthNotice("Please sign in with your Patient account to book an appointment.");
      setActiveModal("login");
      return;
    }
    if (user?.role === "Patient") setActiveModal("appointment");
  }

  return (
    <div className="home-page">
      <Navbar
        onLogin={() => openModal("login")}
        onRegister={() => openModal("register")}
      />

      <Hero
        onBookAppointment={openBooking}
      />

      <Services
        onBookService={openBooking}
      />

      <About />

      <PatientManagement
        onRegister={() => openModal("register")}
      />

      <Location />

      <Reviews />

      <Footer 
        onLogin={() => openModal("login")}
        onRegister={() => openModal("register")}
        onBookAppointment={openBooking}
      />


      {activeModal === "login" && (
        <LoginModal
        onClose={() => openModal(null)}
        onSwitchToRegister={() => openModal("register")}
        onForgotPassword={() => openModal("forgotPassword")}
        notice={authNotice}
        verificationEmail={verificationEmail}
        />
      )}

      {activeModal === "register" && (
        <RegisterModal
        onClose={() => setActiveModal(null)}
        onSwitchToLogin={() => setActiveModal("login")}
        onRegistered={(email) => { setAuthNotice(""); setVerificationEmail(email); setActiveModal("login"); }}
        />
      )}

      {activeModal === "forgotPassword" && (
        <ForgotPasswordModal
        onClose={() => setActiveModal(null)}
        onBackToLogin={() => setActiveModal("login")}
        />
      )}

      {activeModal === "appointment" && (
        <AppointmentModal onClose={() => setActiveModal(null)} 
        />
      )}
      
    </div>
  );
}

export default Home;
