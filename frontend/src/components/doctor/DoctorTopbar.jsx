import { FaBars, FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import ThemeToggle from "../ThemeToggle";
import PatientAvatar from "../patient/PatientAvatar";

export default function DoctorTopbar({ title, subtitle, doctorName, doctorInitials, doctorPhotoUrl, onToggleSidebar }) {
  const navigate = useNavigate();
  const notificationCount = useNotifications().getUnreadCount("Doctor");
  return <header className="doctor-topbar"><div className="doctor-topbar-left"><button type="button" className="doctor-topbar-menu-button" onClick={onToggleSidebar} aria-label="Open doctor menu"><FaBars /></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="doctor-topbar-actions"><ThemeToggle /><button type="button" className="doctor-topbar-notifications" aria-label="Notifications" onClick={() => navigate("/doctor-notifications")}><FaBell />{notificationCount > 0 && <span>{notificationCount}</span>}</button><button type="button" className="doctor-topbar-profile" onClick={() => navigate("/doctor-profile")} aria-label="Open doctor profile"><PatientAvatar className="doctor-topbar-avatar" photoUrl={doctorPhotoUrl} initials={doctorInitials} alt="Doctor profile"/><div><strong>{doctorName}</strong><span>Doctor</span></div></button></div></header>;
}
