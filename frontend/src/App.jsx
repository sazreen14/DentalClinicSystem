import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import PatientDashboard from "./pages/PatientDashboard";
import PatientAppointments from "./pages/PatientAppointments";
import PatientRecords from "./pages/PatientRecords";
import PatientNotifications from "./pages/PatientNotifications";
import PatientProfile from "./pages/PatientProfile";
import PatientSettings from "./pages/PatientSettings";
import PatientInvoices from "./pages/PatientInvoices";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorAppointments from "./pages/DoctorAppointments";
import DoctorPatientRecords from "./pages/DoctorPatientRecords";
import DoctorSchedule from "./pages/DoctorSchedule";
import DoctorProfile from "./pages/DoctorProfile";
import DoctorSettings from "./pages/DoctorSettings";
import DoctorNotifications from "./pages/DoctorNotifications";
import DoctorInvoices from "./pages/DoctorInvoices";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAppointments from "./pages/AdminAppointments";
import AdminSchedule from "./pages/AdminSchedule";
import AdminUsers from "./pages/AdminUsers";
import AdminPatientRecords from "./pages/AdminPatientRecords";
import AdminClinicOperations from "./pages/AdminClinicOperations";
import AdminSettings from "./pages/AdminSettings";
import AdminNotifications from "./pages/AdminNotifications";
import AdminInvoices from "./pages/AdminInvoices";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import { ClinicOperationsProvider } from "./context/ClinicOperationsContext";
import { AppointmentsProvider } from "./context/AppointmentsContext";
import { IdentityProvider } from "./context/IdentityContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

function AuthenticatedApp() {
  return (
    <AuthProvider>
    <ClinicOperationsProvider>
      <AppointmentsProvider>
      <IdentityProvider>
      <NotificationsProvider>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute allowedRoles={["Patient"]} />}>
        <Route
          path="/patient-dashboard"
          element={<PatientDashboard />}
        />

        <Route
          path="/patient-appointments"
          element={<PatientAppointments />}
        />

        <Route
          path="/patient-records"
          element={<PatientRecords />}
        />

        <Route
        path="/patient-notifications"
        element={<PatientNotifications />}
        />

        <Route
        path="/patient-profile"
        element={<PatientProfile />}
        />

        <Route
        path="/patient-settings"
        element={<PatientSettings />}
        />
        <Route path="/patient-invoices" element={<PatientInvoices />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["Doctor"]} />}>
        <Route
        path="/doctor-dashboard"
        element={<DoctorDashboard />}
        />

        <Route
        path="/doctor-appointments"
        element={<DoctorAppointments />}
        />

        <Route
        path="/doctor-patient-records"
        element={<DoctorPatientRecords />}
        />

        <Route
        path="/doctor-schedule"
        element={<DoctorSchedule />}
        />

        <Route
        path="/doctor-profile"
        element={<DoctorProfile />}
        />

        <Route
        path="/doctor-settings"
        element={<DoctorSettings />}
        />

        <Route
        path="/doctor-notifications"
        element={<DoctorNotifications />}
        />
        <Route path="/doctor-invoices" element={<DoctorInvoices />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
        <Route
        path="/admin-dashboard"
        element={<AdminDashboard />}
        />

        <Route
        path="/admin-appointments"
        element={<AdminAppointments />}
        />

        <Route
        path="/admin-schedule"
        element={<AdminSchedule />}
        />

        <Route
        path="/admin-users"
        element={<AdminUsers />}
        />

        <Route
        path="/admin-patient-records"
        element={<AdminPatientRecords />}
        />

        <Route
        path="/admin-clinic-operations"
        element={<AdminClinicOperations />}
        />

        <Route
        path="/admin-settings"
        element={<AdminSettings />}
        />

        <Route
        path="/admin-notifications"
        element={<AdminNotifications />}
        />
        <Route path="/admin-invoices" element={<AdminInvoices />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        </Routes>
      </NotificationsProvider>
      </IdentityProvider>
      </AppointmentsProvider>
    </ClinicOperationsProvider>
    </AuthProvider>

  );
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="*" element={<AuthenticatedApp />} />
  </Routes></BrowserRouter>;
}

export default App;
