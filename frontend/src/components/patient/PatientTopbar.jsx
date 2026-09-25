import {
  FaBars,
  FaBell,
  FaCalendarAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import ThemeToggle from "../ThemeToggle";
import PatientAvatar from "./PatientAvatar";

function PatientTopbar({
  title = "Overview",
  subtitle = "Patient Portal · Klinik Pergigian Rosni Adam",
  patientName = "Patient",
  patientInitials = "P",
  patientPhotoUrl = null,
  onBookAppointment,
  onToggleSidebar,
}) {
  const navigate = useNavigate();
  const { getUnreadCount } = useNotifications();
  const notificationCount = getUnreadCount("Patient");
  return (
    <header className="figma-patient-topbar">
      <div className="figma-topbar-left">
        <button
          type="button"
          className="figma-topbar-menu-button"
          onClick={onToggleSidebar}
          aria-label="Open patient menu"
        >
          <FaBars />
        </button>

        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="figma-topbar-actions">
        <ThemeToggle />
        <button
          type="button"
          className="figma-topbar-book-button"
          onClick={onBookAppointment}
        >
          <FaCalendarAlt />
          <span>Book Appointment</span>
        </button>

        <button
          type="button"
          className="figma-topbar-notification-button"
          aria-label="Notifications"
          onClick={() => navigate("/patient-notifications")}
        >
          <FaBell />

          {notificationCount > 0 && (
            <span>{notificationCount}</span>
          )}
        </button>

        <button type="button" className="figma-topbar-profile" onClick={() => navigate("/patient-profile")} aria-label="Open patient profile">
          <PatientAvatar className="figma-topbar-avatar" photoUrl={patientPhotoUrl} initials={patientInitials} />

          <div>
            <strong>{patientName}</strong>
            <span>Patient</span>
          </div>
        </button>
      </div>
    </header>
  );
}

export default PatientTopbar;
