import { useState } from "react";

import PatientSidebar from "./PatientSidebar";
import PatientTopbar from "./PatientTopbar";
import AppointmentModal from "../modals/AppointmentModal";
import { useIdentity } from "../../context/useIdentity";
import { useAuth } from "../../context/useAuth";

import "../../styles/PatientLayout.css";

function PatientLayout({
  activePage = "overview",
  pageTitle = "Overview",
  pageSubtitle = "Patient Portal · Klinik Pergigian Rosni Adam",
  patientName = "Patient",
  patientId = "Patient ID",
  patientInitials = "P",
  children,
}) {
  const { patients, loading: identityLoading } = useIdentity();
  const { user } = useAuth();
  const currentPatient = user?.patientId
    ? patients.find((patient) => patient.patientId === user.patientId)
    : null;
  const displayedName = currentPatient?.fullName || user?.fullName || (identityLoading ? "Loading…" : patientName);
  const displayedId = `Patient ID: ${user?.patientId || currentPatient?.patientId || patientId.replace("Patient ID: ", "")}`;
  const displayedInitials = currentPatient?.initials || user?.fullName?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || patientInitials;
  const photoUrl = currentPatient?.photoUrl || null;
  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  function toggleMobileSidebar() {
    setMobileSidebarOpen((previous) => !previous);
  }

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  return (
    <div className="figma-patient-layout">
      <div
        className={`figma-sidebar-wrapper ${
          mobileSidebarOpen ? "open" : ""
        }`}
      >
        <PatientSidebar
          activePage={activePage}
          patientName={displayedName}
          patientId={displayedId}
          patientInitials={displayedInitials}
          patientPhotoUrl={photoUrl}
        />
      </div>

      {mobileSidebarOpen && (
        <button
          type="button"
          className="figma-sidebar-overlay"
          onClick={closeMobileSidebar}
          aria-label="Close patient menu"
        />
      )}

      <div className="figma-patient-content">
        <PatientTopbar
          title={pageTitle}
          subtitle={pageSubtitle}
          patientName={displayedName}
          patientInitials={displayedInitials}
          patientPhotoUrl={photoUrl}
          onBookAppointment={() => setBookingOpen(true)}
          onToggleSidebar={toggleMobileSidebar}
        />

        <main className="figma-patient-page">
          {children}
        </main>
      </div>
      {bookingOpen && <AppointmentModal onClose={() => setBookingOpen(false)} />}
    </div>
  );
}

export default PatientLayout;
