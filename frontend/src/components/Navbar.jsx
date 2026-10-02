import { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { useClinicOperations } from "../context/useClinicOperations";
import ThemeToggle from "./ThemeToggle";
import "../styles/Navbar.css";

function Navbar({ onLogin, onRegister }) {
  const { clinicInfo } = useClinicOperations();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar" aria-label="Public navigation">
      <div className="container navbar-content">
        <a className="clinic-brand" href="#home" onClick={closeMenu} aria-label={`${clinicInfo.clinicName} home`}>
          <div className="tooth-logo" aria-hidden="true"><img src="/clinic-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit", display: "block" }} /></div>
          <div><h2>{clinicInfo.clinicName}</h2><small>Secure Dental Patient Portal</small></div>
        </a>
        <div id="public-nav-links" className={`nav-links ${menuOpen ? "open" : ""}`}>
          {[["home","Home"],["services","Services"],["about","About"],["location","Location"],["reviews","Reviews"]].map(([id,label]) => <a href={`#${id}`} onClick={closeMenu} key={id}>{label}</a>)}
          <div className="nav-mobile-auth"><button type="button" onClick={() => { closeMenu(); onLogin(); }}>Login</button><button type="button" onClick={() => { closeMenu(); onRegister(); }}>Register</button></div>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <button type="button" className="btn-secondary" onClick={onLogin}>Login</button>
          <button type="button" className="btn-primary" onClick={onRegister}>Register</button>
          <button type="button" className="nav-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="public-nav-links" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}>{menuOpen ? <FaTimes /> : <FaBars />}</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
