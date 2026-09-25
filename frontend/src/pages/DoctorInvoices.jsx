import DoctorLayout from "../components/doctor/DoctorLayout";
import InvoiceWorkspace from "../components/invoices/InvoiceWorkspace";

export default function DoctorInvoices() {
  return <DoctorLayout activePage="invoices" pageTitle="Invoices" pageSubtitle="Review invoices for Patients in your care."><InvoiceWorkspace role="Doctor" /></DoctorLayout>;
}
