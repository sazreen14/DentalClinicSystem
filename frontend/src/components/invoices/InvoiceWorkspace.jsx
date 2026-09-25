import { useCallback, useEffect, useMemo, useState } from "react";
import { FaDownload, FaFileInvoiceDollar, FaPlus, FaSave, FaSearch, FaTimes } from "react-icons/fa";
import { addInvoiceItem, createInvoice, getInvoice, getInvoicePdf, issueInvoice, listInvoices, removeInvoiceItem, updateInvoiceItem } from "../../services/invoicesApi";
import { matchesPatientInvoiceSearch } from "../../utils/patientInvoiceSearch";
import "../../styles/Invoices.css";

const EMPTY_ITEM = { description: "", quantity: 1, unitPrice: "0.00" };
const money = (value) => `RM ${Number(value || 0).toFixed(2)}`;
const date = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "Not issued";

export default function InvoiceWorkspace({ role, patients = [], appointments = [] }) {
  const isAdmin = role === "Admin";
  const [invoices, setInvoices] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setInvoices(await listInvoices()); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(loadList); }, [loadList]);

  const openInvoice = useCallback(async (invoiceId) => {
    setSelectedId(invoiceId);
    setDetailLoading(true);
    setError("");
    try { setSelected(await getInvoice(invoiceId)); }
    catch (requestError) { setError(requestError.message); }
    finally { setDetailLoading(false); }
  }, []);

  const visibleInvoices = useMemo(() => {
    if (role === "Patient") return invoices.filter((invoice) => matchesPatientInvoiceSearch(invoice, search));
    const query = search.trim().toLowerCase();
    return query ? invoices.filter((invoice) => `${invoice.invoiceNumber} ${invoice.patientName} ${invoice.status}`.toLowerCase().includes(query)) : invoices;
  }, [invoices, role, search]);

  async function downloadPdf(invoice) {
    try {
      const blob = await getInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(requestError.message); }
  }

  async function commit(value, message) {
    setSelected(value);
    setSelectedId(value.id);
    setFeedback(message);
    await loadList();
  }

  return <>
    <section className="invoice-heading">
      <div><span>Secure Billing</span><h2>{isAdmin ? "Invoices & Billing" : role === "Doctor" ? "Patient Invoices" : "My Invoices"}</h2><p>{isAdmin ? "Create, review and issue clinic invoices." : "Review issued invoices and download secure PDF copies."}</p></div>
      {isAdmin ? <button type="button" onClick={() => setCreating(true)}><FaPlus /> Create Invoice</button> : <div className="invoice-heading-icon"><FaFileInvoiceDollar /></div>}
    </section>

    {feedback ? <div className="invoice-feedback" role="status"><span>{feedback}</span><button type="button" aria-label="Dismiss message" onClick={() => setFeedback("")}><FaTimes /></button></div> : null}
    {error ? <p className="invoice-error" role="alert">{error}</p> : null}

    <section className="invoice-workspace">
      <div className="invoice-list-card">
        <header><div><span>Invoice Directory</span><h3>{isAdmin ? "All Invoices" : "Issued Invoices"}</h3></div><label><FaSearch aria-hidden="true" /><span className="sr-only">Search invoices</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={role === "Patient" ? "Search invoice, date, amount or status" : "Search invoices"} /></label></header>
        {loading ? <p className="invoice-state" role="status">Loading invoices…</p> : null}
        {!loading && !visibleInvoices.length ? <div className="invoice-empty"><FaFileInvoiceDollar /><h3>No invoices found</h3><p>{search.trim() && role === "Patient" ? "Try another invoice number, date, amount, status or appointment reference." : isAdmin ? "Create a Draft invoice when billing is required." : "Issued invoices will appear here."}</p></div> : null}
        {!loading ? <div className="invoice-list">{visibleInvoices.map((invoice) => <button type="button" className={selectedId === invoice.id ? "active" : ""} key={invoice.id} onClick={() => openInvoice(invoice.id)}><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.patientName}</small></span><span><b className={`invoice-status ${invoice.status.toLowerCase()}`}>{invoice.status}</b><small>{date(invoice.issueDate)}</small></span><strong>{money(invoice.total)}</strong></button>)}</div> : null}
      </div>

      <div className="invoice-detail-card">
        {detailLoading ? <p className="invoice-state" role="status">Loading invoice details…</p> : null}
        {!detailLoading && !selected ? <div className="invoice-empty"><FaFileInvoiceDollar /><h3>Select an invoice</h3><p>Choose an invoice to review its item breakdown.</p></div> : null}
        {!detailLoading && selected ? <InvoiceDetail invoice={selected} isAdmin={isAdmin} onChange={commit} onDownload={downloadPdf} onError={(message) => setError(message)} /> : null}
      </div>
    </section>

    {creating ? <CreateInvoiceModal patients={patients} appointments={appointments} onClose={() => setCreating(false)} onCreated={async (value) => { setCreating(false); await commit(value, "Draft invoice created."); }} onError={(message) => setError(message)} /> : null}
  </>;
}

function InvoiceDetail({ invoice, isAdmin, onChange, onDownload, onError }) {
  const editable = isAdmin && invoice.status === "Draft";
  async function issue() {
    if (!window.confirm("Issue this invoice? Financial contents cannot be edited afterward.")) return;
    try { await onChange(await issueInvoice(invoice.id), "Invoice issued successfully."); }
    catch (error) { onError(error.message); }
  }
  return <>
    <header className="invoice-detail-header"><div><span>{invoice.status}</span><h3>{invoice.invoiceNumber}</h3><p>{invoice.patient.name} · {invoice.patient.id}</p></div><button type="button" onClick={() => onDownload(invoice)}><FaDownload /> Download PDF</button></header>
    <div className="invoice-detail-meta"><p><span>Issue Date</span><strong>{date(invoice.issueDate)}</strong></p><p><span>Appointment</span><strong>{invoice.appointment?.id || "Not linked"}</strong></p><p><span>Status</span><strong>{invoice.status}</strong></p></div>
    <section className="invoice-items"><header><h4>Invoice Items</h4>{editable ? <span>Draft items are editable</span> : <span>Issued financial record</span>}</header>
      <div className="invoice-items-head"><span>Description</span><span>Qty</span><span>Unit Price</span><span>Line Total</span><span /></div>
      {invoice.items.map((item) => editable ? <DraftItemRow key={item.id} invoiceId={invoice.id} item={item} onChange={onChange} onError={onError} /> : <div className="invoice-item-row" key={item.id}><span>{item.description}</span><span>{item.quantity}</span><span>{money(item.unitPrice)}</span><strong>{money(item.lineTotal)}</strong><span /></div>)}
      {editable ? <AddItemRow invoiceId={invoice.id} onChange={onChange} onError={onError} /> : null}
    </section>
    <div className="invoice-totals"><p><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></p><p><span>Total</span><strong>{money(invoice.total)}</strong></p></div>
    {editable ? <footer className="invoice-detail-actions"><button type="button" className="primary" disabled={!invoice.items.length} onClick={issue}>Issue Invoice</button></footer> : null}
  </>;
}

function DraftItemRow({ invoiceId, item, onChange, onError }) {
  const [draft, setDraft] = useState({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice });
  async function save() { try { await onChange(await updateInvoiceItem(invoiceId, item.id, { ...draft, quantity: Number(draft.quantity) }), "Invoice item updated."); } catch (error) { onError(error.message); } }
  async function remove() { if (!window.confirm("Remove this Draft invoice item?")) return; try { await onChange(await removeInvoiceItem(invoiceId, item.id), "Invoice item removed."); } catch (error) { onError(error.message); } }
  return <div className="invoice-item-row editable"><input aria-label="Item description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /><input aria-label="Quantity" type="number" min="1" max="10000" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /><input aria-label="Unit price" inputMode="decimal" value={draft.unitPrice} onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })} /><strong>{money(item.lineTotal)}</strong><span className="invoice-row-actions"><button type="button" aria-label="Save item" onClick={save}><FaSave /></button><button type="button" aria-label="Remove item" onClick={remove}><FaTimes /></button></span></div>;
}

function AddItemRow({ invoiceId, onChange, onError }) {
  const [item, setItem] = useState(EMPTY_ITEM);
  async function add() { try { await onChange(await addInvoiceItem(invoiceId, { ...item, quantity: Number(item.quantity) }), "Invoice item added."); setItem(EMPTY_ITEM); } catch (error) { onError(error.message); } }
  return <div className="invoice-item-row editable add"><input aria-label="New item description" placeholder="Description" value={item.description} onChange={(event) => setItem({ ...item, description: event.target.value })} /><input aria-label="New item quantity" type="number" min="1" max="10000" value={item.quantity} onChange={(event) => setItem({ ...item, quantity: event.target.value })} /><input aria-label="New item unit price" inputMode="decimal" value={item.unitPrice} onChange={(event) => setItem({ ...item, unitPrice: event.target.value })} /><span /><button type="button" onClick={add}><FaPlus /> Add</button></div>;
}

function CreateInvoiceModal({ patients, appointments, onClose, onCreated, onError }) {
  const [patientId, setPatientId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const validAppointments = appointments.filter((appointment) => appointment.patientId === patientId);
  const displayedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  async function submit(event) {
    event.preventDefault();
    try { await onCreated(await createInvoice({ patientId, appointmentId: appointmentId || null, items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })) })); }
    catch (error) { onError(error.message); }
  }
  return <div className="invoice-modal-overlay" onMouseDown={onClose}><section className="invoice-modal" role="dialog" aria-modal="true" aria-labelledby="create-invoice-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>Admin Billing</span><h2 id="create-invoice-title">Create Draft Invoice</h2></div><button type="button" onClick={onClose} aria-label="Close"><FaTimes /></button></header><form onSubmit={submit}><label><span>Patient</span><select required value={patientId} onChange={(event) => { setPatientId(event.target.value); setAppointmentId(""); }}><option value="">Select Patient</option>{patients.filter((patient) => patient.accountStatus === "Active").map((patient) => <option value={patient.patientId} key={patient.patientId}>{patient.fullName} · {patient.patientId}</option>)}</select></label><label><span>Related Appointment (Optional)</span><select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}><option value="">No appointment selected</option>{validAppointments.map((appointment) => <option value={appointment.id} key={appointment.id}>{appointment.date} · {appointment.time} · {appointment.service}</option>)}</select></label><div className="invoice-create-items"><h3>Initial Items</h3>{items.map((item, index) => <div className="invoice-create-item" key={index}><input required aria-label={`Item ${index + 1} description`} placeholder="Description" value={item.description} onChange={(event) => setItems((values) => values.map((value, itemIndex) => itemIndex === index ? { ...value, description: event.target.value } : value))} /><input required aria-label={`Item ${index + 1} quantity`} type="number" min="1" max="10000" value={item.quantity} onChange={(event) => setItems((values) => values.map((value, itemIndex) => itemIndex === index ? { ...value, quantity: event.target.value } : value))} /><input required aria-label={`Item ${index + 1} unit price`} inputMode="decimal" value={item.unitPrice} onChange={(event) => setItems((values) => values.map((value, itemIndex) => itemIndex === index ? { ...value, unitPrice: event.target.value } : value))} />{items.length > 1 ? <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((values) => values.filter((_, itemIndex) => itemIndex !== index))}><FaTimes /></button> : <span />}</div>)}</div><button type="button" className="add-line" onClick={() => setItems((values) => [...values, { ...EMPTY_ITEM }])}><FaPlus /> Add Item</button><p className="invoice-draft-total"><span>Displayed Draft Total</span><strong>{money(displayedTotal)}</strong><small>The server recalculates and verifies the authoritative total.</small></p><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Create Draft</button></footer></form></section></div>;
}
