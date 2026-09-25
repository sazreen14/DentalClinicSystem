import { useEffect, useState } from "react";
import AdminLayout from "../components/admin/AdminLayout";
import InvoiceWorkspace from "../components/invoices/InvoiceWorkspace";
import { useAppointments } from "../context/useAppointments";
import { getAdminPatients } from "../services/identityApi";

export default function AdminInvoices() {
  const { appointments } = useAppointments();
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState("");
  useEffect(() => {
    let active = true;
    getAdminPatients().then((items) => { if (active) setPatients(items.filter((patient) => !patient.patientId.startsWith("PT-DEV-"))); }).catch((error) => { if (active) setPatientsError(error.message); }).finally(() => { if (active) setPatientsLoading(false); });
    return () => { active = false; };
  }, []);
  return <AdminLayout activePage="invoices" pageTitle="Invoices & Billing" pageSubtitle="Create and manage secure clinic invoices.">{patientsLoading ? <p role="status">Loading Patients...</p> : null}{patientsError ? <p role="alert">Patients could not be loaded: {patientsError}</p> : null}<InvoiceWorkspace role="Admin" patients={patients} appointments={appointments} /></AdminLayout>;
}
