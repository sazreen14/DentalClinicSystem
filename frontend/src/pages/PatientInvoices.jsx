import PatientLayout from "../components/patient/PatientLayout";
import InvoiceWorkspace from "../components/invoices/InvoiceWorkspace";

export default function PatientInvoices() {
  return <PatientLayout activePage="invoices" pageTitle="Invoices & Billing" pageSubtitle="View your issued clinic invoices."><InvoiceWorkspace role="Patient" /></PatientLayout>;
}
