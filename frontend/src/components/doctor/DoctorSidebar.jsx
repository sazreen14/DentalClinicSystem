import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import { useAuth } from "../../context/useAuth";
import PatientAvatar from "../patient/PatientAvatar";

import {
  FaCalendarAlt,
  FaBell,
  FaClipboardList,
  FaCog,
  FaHome,
  FaFileInvoiceDollar,
  FaSignOutAlt,
  FaUser,
} from "react-icons/fa";

const menuItems = [
  { id: "overview", label: "Overview", icon: <FaHome />, path: "/doctor-dashboard" },
  { id: "appointments", label: "Appointments", icon: <FaCalendarAlt />, path: "/doctor-appointments", badge: 5 },
  { id: "schedule", label: "Schedule", icon: <FaCalendarAlt />, path: "/doctor-schedule" },
  { id: "records", label: "Patient Records", icon: <FaClipboardList />, path: "/doctor-patient-records" },
  { id: "invoices", label: "Invoices", icon: <FaFileInvoiceDollar />, path: "/doctor-invoices" },
  { id: "notifications", label: "Notifications", icon: <FaBell />, path: "/doctor-notifications" },
  { id: "profile", label: "My Profile", icon: <FaUser />, path: "/doctor-profile" },
  { id: "settings", label: "Settings", icon: <FaCog />, path: "/doctor-settings" },
];

function DoctorSidebar({ activePage = "overview", doctorName = "Dr. Rosni Adam", doctorInitials = "RA", doctorPhotoUrl = null }) {
  const navigate = useNavigate();
  const { getUnreadCount } = useNotifications();
  const notificationCount = getUnreadCount("Doctor");
  const { logout } = useAuth();
  async function handleLogout() { await logout(); navigate("/", { replace: true }); }

  return (
    <aside className="doctor-sidebar">
      <div className="doctor-sidebar-brand">
        <div className="doctor-sidebar-logo">
          <img src="/clinic-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit", display: "block" }} />
        </div>
        <div>
          <strong>Klinik Pergigian</strong>
          <span>Rosni Adam</span>
        </div>
      </div>

      <div className="doctor-sidebar-user">
        <PatientAvatar className="doctor-sidebar-avatar" photoUrl={doctorPhotoUrl} initials={doctorInitials} alt="Doctor profile" />
        <div>
          <strong>{doctorName}</strong>
          <span>Dental Surgeon</span>
        </div>
      </div>

      <nav className="doctor-sidebar-navigation" aria-label="Doctor portal">
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`doctor-sidebar-menu ${activePage === item.id ? "active" : ""}`}
            onClick={() => item.path && navigate(item.path)}
          >
            <span className="doctor-sidebar-menu-icon">{item.icon}</span>
            <span className="doctor-sidebar-menu-label">{item.label}</span>
            {(item.badge || (item.id === "notifications" && notificationCount > 0)) && <span className="doctor-sidebar-badge">{item.id === "notifications" ? notificationCount : item.badge}</span>}
          </button>
        ))}
      </nav>

      <button type="button" className="doctor-sidebar-logout" onClick={handleLogout}>
        <FaSignOutAlt />
        <span>Logout</span>
      </button>
    </aside>
  );
}

export default DoctorSidebar;
