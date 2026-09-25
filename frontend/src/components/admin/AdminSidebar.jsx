import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import { useAuth } from "../../context/useAuth";
import { FaBell, FaCalendarAlt, FaClipboardList, FaCog, FaFileInvoiceDollar, FaHome, FaSignOutAlt, FaStore, FaUsers } from "react-icons/fa";
import { MdMedicalServices } from "react-icons/md";

const menuItems = [
  { id: "overview", label: "Overview", icon: <FaHome />, path: "/admin-dashboard" },
  { id: "appointments", label: "Appointments", icon: <FaCalendarAlt />, path: "/admin-appointments" },
  { id: "schedule", label: "Schedule", icon: <FaCalendarAlt />, path: "/admin-schedule" },
  { id: "users", label: "Users", icon: <FaUsers />, path: "/admin-users" },
  { id: "records", label: "Patient Records", icon: <FaClipboardList />, path: "/admin-patient-records" },
  { id: "operations", label: "Clinic Operations", icon: <FaStore />, path: "/admin-clinic-operations" },
  { id: "invoices", label: "Invoices & Billing", icon: <FaFileInvoiceDollar />, path: "/admin-invoices" },
  { id: "notifications", label: "Notifications", icon: <FaBell />, path: "/admin-notifications" },
  { id: "settings", label: "Settings", icon: <FaCog />, path: "/admin-settings" },
];

function AdminSidebar({ activePage = "overview", adminName = "Clinic Admin", adminInitials = "AD" }) {
  const navigate = useNavigate();
  const { getUnreadCount } = useNotifications();
  const notificationCount = getUnreadCount("Admin");
  const { logout } = useAuth();
  async function handleLogout() { await logout(); navigate("/", { replace: true }); }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand"><div className="admin-sidebar-logo"><MdMedicalServices /></div><div><strong>Klinik Pergigian</strong><span>Rosni Adam</span></div></div>
      <div className="admin-sidebar-user"><div className="admin-sidebar-avatar">{adminInitials}</div><div><strong>{adminName}</strong><span>Administrator</span></div></div>
      <nav className="admin-sidebar-navigation" aria-label="Admin portal">
        {menuItems.map((item) => (
          <button type="button" key={item.id} className={`admin-sidebar-menu ${activePage === item.id ? "active" : ""}`} onClick={() => item.path && navigate(item.path)}>
            <span className="admin-sidebar-menu-icon">{item.icon}</span><span className="admin-sidebar-menu-label">{item.label}</span>{item.id === "notifications" && notificationCount > 0 && <span className="admin-sidebar-badge">{notificationCount}</span>}
          </button>
        ))}
      </nav>
      <button type="button" className="admin-sidebar-logout" onClick={handleLogout}><FaSignOutAlt /><span>Logout</span></button>
    </aside>
  );
}

export default AdminSidebar;
