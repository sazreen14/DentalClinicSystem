import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const dashboards = { Patient: "/patient-dashboard", Doctor: "/doctor-dashboard", Admin: "/admin-dashboard" };

function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <div role="status" aria-live="polite" style={{ padding: "2rem", textAlign: "center" }}>Restoring your secure session…</div>;
  if (!isAuthenticated) return <Navigate to="/" replace state={{ openLogin: true, from: location.pathname }} />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={dashboards[user.role] || "/"} replace />;
  return <Outlet />;
}

export default ProtectedRoute;
