import { FaBars, FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/useNotifications";
import ThemeToggle from "../ThemeToggle";

export default function AdminTopbar({ title, subtitle, onToggleSidebar, adminName = "Clinic Admin", adminInitials = "AD" }) {
  const navigate = useNavigate();
  const notificationCount = useNotifications().getUnreadCount("Admin");
  return <header className="admin-topbar"><div className="admin-topbar-left"><button type="button" className="admin-topbar-menu" onClick={onToggleSidebar} aria-label="Open admin menu"><FaBars /></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="admin-topbar-actions"><ThemeToggle /><button type="button" className="admin-notification-button" aria-label="Notifications" onClick={() => navigate("/admin-notifications")}><FaBell />{notificationCount > 0 && <span>{notificationCount}</span>}</button><button type="button" className="admin-topbar-profile" onClick={() => navigate("/admin-settings", { state: { settingsTab: "account" } })} aria-label="Open administrator account settings"><div>{adminInitials}</div><span><strong>{adminName}</strong><small>Administrator</small></span></button></div></header>;
}
