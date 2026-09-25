import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import { useAuth } from "../../context/useAuth";
import PatientAvatar from "./PatientAvatar";

import {
  FaHome,
  FaCalendarAlt,
  FaClipboardList,
  FaBell,
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaFileInvoiceDollar,
} from "react-icons/fa";

const menuItems = [
  {
    id: "overview",
    label: "Overview",
    icon: <FaHome />,
    path: "/patient-dashboard",
  },
  {
    id: "appointments",
    label: "Appointments",
    icon: <FaCalendarAlt />,
    path: "/patient-appointments",
  },
  {
    id: "records",
    label: "Medical Records",
    icon: <FaClipboardList />,
    path: "/patient-records",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <FaBell />,
    path: "/patient-notifications",
    badge: 2,
  },
  {
    id: "invoices",
    label: "Invoices & Billing",
    icon: <FaFileInvoiceDollar />,
    path: "/patient-invoices",
  },
  {
    id: "profile",
    label: "My Profile",
    icon: <FaUser />,
    path: "/patient-profile",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <FaCog />,
    path: "/patient-settings",
  },
];

function PatientSidebar({
  activePage = "overview",
  patientName = "Patient",
  patientId = "Patient ID unavailable",
  patientInitials = "P",
  patientPhotoUrl = null,
}) {
  const navigate = useNavigate();
  const { getUnreadCount } = useNotifications();
  const { logout } = useAuth();
  const notificationCount = getUnreadCount("Patient");

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <aside className="figma-patient-sidebar">
      <div className="figma-sidebar-brand">
        <div className="figma-sidebar-logo">
          🦷
        </div>

        <div>
          <strong>Klinik Pergigian</strong>
          <span>Rosni Adam</span>
        </div>
      </div>

      <div className="figma-sidebar-patient">
        <PatientAvatar className="figma-sidebar-avatar" photoUrl={patientPhotoUrl} initials={patientInitials} />

        <div>
          <strong>{patientName}</strong>
          <span>{patientId}</span>
        </div>
      </div>

      <nav className="figma-sidebar-navigation">
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={
              activePage === item.id
                ? "figma-sidebar-menu active"
                : "figma-sidebar-menu"
            }
            onClick={() => navigate(item.path)}
          >
            <span className="figma-sidebar-menu-icon">
              {item.icon}
            </span>

            <span className="figma-sidebar-menu-label">
              {item.label}
            </span>

            {(item.badge || (item.id === "notifications" && notificationCount > 0)) && (
              <span className="figma-sidebar-badge">
                {item.id === "notifications" ? notificationCount : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="figma-sidebar-logout"
        onClick={handleLogout}
      >
        <FaSignOutAlt />
        <span>Logout</span>
      </button>
    </aside>
  );
}

export default PatientSidebar;
