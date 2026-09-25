import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  FaAllergies,
  FaArrowLeft,
  FaCalendarAlt,
  FaCheck,
  FaChevronRight,
  FaClipboardList,
  FaEnvelope,
  FaFileMedical,
  FaHome,
  FaIdCard,
  FaNotesMedical,
  FaPhoneAlt,
  FaPills,
  FaPrint,
  FaSearch,
  FaTooth,
  FaTimes,
  FaUser,
  FaUserFriends,
} from "react-icons/fa";

import DoctorLayout from "../components/doctor/DoctorLayout";
import { useAuth } from "../context/useAuth";
import DentalChart from "../components/clinical/DentalChart";
import ClinicalImages from "../components/clinical/ClinicalImages";
import { addDoctorClinicalNote, amendDoctorClinicalNote, createPatientInstruction, getDoctorPatientRecord, getDoctorPatients, publishPatientInstruction, updateDoctorClinicalProfile, withdrawPatientInstruction } from "../services/clinicalRecordsApi";

import "../styles/DoctorPatientRecords.css";


const filters = [
  { id: "all", label: "All Patients" },
  { id: "today", label: "Visited Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

function formatPatientRecord(value) {
  const today = new Date().toISOString().slice(0, 10);
  const previous = value.appointments.find((item) => item.status === "Completed")
    || value.appointments.find((item) => item.date < today);
  const upcoming = value.appointments
    .filter((item) => item.date >= today && !["Completed", "Cancelled"].includes(item.status))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return {
    ...value,
    id: value.patientId,
    status: value.status,
    dateOfBirth: new Date(`${value.dateOfBirth}T00:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" }),
    diagnosis: value.clinicalNotes[0]?.diagnosis || "Not recorded",
    treatmentPlan: value.encounters[0]?.treatmentPlan || "Not recorded",
    prescriptions: value.clinicalNotes[0]?.prescription || "None",
    clinicalNotes: value.clinicalNotes[0]?.clinicalNote || "Not recorded",
    clinicalNotesHistory: value.clinicalNotes,
    appointments: {
      previous: previous ? `${previous.date}, ${previous.time} · ${previous.service}` : "No previous appointment",
      upcoming: upcoming ? `${upcoming.date}, ${upcoming.time} · ${upcoming.service}` : "No upcoming appointment",
    },
  };
}

function DoctorPatientRecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const [patients,setPatients]=useState([]);
  const [directoryLoading,setDirectoryLoading]=useState(true);
  const [directoryError,setDirectoryError]=useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedPatientId, setSelectedPatientId] = useState(location.state?.patientId ?? null);
  const [selectedPatient,setSelectedPatient]=useState(null);
  const [recordLoading,setRecordLoading]=useState(Boolean(location.state?.patientId));
  const [clinicalNoteModalOpen, setClinicalNoteModalOpen] = useState(false);
  const [amendingNote,setAmendingNote]=useState(null);
  const [profileModalOpen,setProfileModalOpen]=useState(false);
  const [instructionModalOpen,setInstructionModalOpen]=useState(false);
  const [recordMessage,setRecordMessage]=useState("");

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesPeriod = activeFilter === "all" || patient.period.includes(activeFilter);
      const matchesSearch = `${patient.name} ${patient.patientId} ${patient.phone}`
        .toLowerCase()
        .includes(query);
      return matchesPeriod && matchesSearch;
    });
  }, [activeFilter, patients, searchTerm]);

  useEffect(()=>{getDoctorPatients().then(items=>setPatients(items.map(item=>({...item,id:item.patientId,period:['today','week','month'],status:item.recordStatus})))).catch(error=>setDirectoryError(error.message)).finally(()=>setDirectoryLoading(false));},[]);
  useEffect(()=>{queueMicrotask(async()=>{if(!selectedPatientId){setSelectedPatient(null);setRecordLoading(false);return;}setRecordLoading(true);setRecordMessage("");try{const value=await getDoctorPatientRecord(selectedPatientId);setSelectedPatient(formatPatientRecord(value));}catch(error){setRecordMessage(`The patient record could not be loaded: ${error.message}`);}finally{setRecordLoading(false);}});},[selectedPatientId]);
  async function refreshSelected(patientId=selectedPatientId){const value=await getDoctorPatientRecord(patientId);const refreshedPatient=formatPatientRecord(value);setSelectedPatient(refreshedPatient);return refreshedPatient;}
  async function saveClinicalRecord(record) {const patientId=selectedPatient.patientId;await addDoctorClinicalNote(patientId,{treatment:record.treatment,treatmentStatus:record.status,diagnosis:record.diagnosis,procedurePerformed:record.procedure,clinicalNote:record.clinicalNote,prescription:record.prescription,followUpRecommendation:record.followUp,...(location.state?.appointmentId&&{appointmentId:location.state.appointmentId})});await refreshSelected(patientId);setClinicalNoteModalOpen(false);setRecordMessage("Clinical note saved. The patient record has been updated.");}
  async function saveAmendment(record){await amendDoctorClinicalNote(selectedPatient.patientId,amendingNote.id,{treatment:record.treatment,treatmentStatus:'Completed',diagnosis:record.diagnosis,procedurePerformed:record.procedure,clinicalNote:record.clinicalNote,prescription:record.prescription,followUpRecommendation:record.followUp,amendmentReason:record.amendmentReason});await refreshSelected();}
  async function saveProfile(values){await updateDoctorClinicalProfile(selectedPatient.patientId,values);await refreshSelected();setProfileModalOpen(false);}
  async function saveInstruction(values){await createPatientInstruction(selectedPatient.patientId,values);await refreshSelected();setInstructionModalOpen(false);}
  async function changeInstructionStatus(instruction,action){if(action==="publish")await publishPatientInstruction(selectedPatient.patientId,instruction.id);else await withdrawPatientInstruction(selectedPatient.patientId,instruction.id);await refreshSelected();}

  function returnFromClinicalRecord() {
    if (location.state?.from === "/doctor-appointments") {
      navigate("/doctor-appointments");
      return;
    }
    if (location.state?.from === "/doctor-schedule") {
      navigate("/doctor-schedule");
      return;
    }
    if (location.state?.from === "/doctor-dashboard") {
      navigate("/doctor-dashboard");
      return;
    }
    setSelectedPatientId(null);
    navigate(location.pathname, { replace: true, state: null });
  }

  return (
    <DoctorLayout
      activePage="records"
      pageTitle="Patient Records"
      pageSubtitle="Patient directory and clinical records"
      doctorName="Dr. Rosni Adam"
      doctorInitials="RA"
    >
      {directoryLoading && <p role="status">Loading patient records…</p>}
      {!directoryLoading && directoryError && <p role="alert">Patient records could not be loaded: {directoryError}</p>}
      {recordMessage && <p role="status">{recordMessage}</p>}
      {recordLoading && !selectedPatient && <p role="status">Loading patient recordâ€¦</p>}
      {selectedPatient ? (
        <PatientClinicalRecord
          patient={selectedPatient}
          backLabel={location.state?.from === "/doctor-appointments" ? "Back to Appointments" : location.state?.from === "/doctor-schedule" ? "Back to Schedule" : location.state?.from === "/doctor-dashboard" ? "Back to Dashboard" : "Back to Patient Records"}
          onBack={returnFromClinicalRecord}
          clinicalRecords={selectedPatient.clinicalNotesHistory || []}
          onAddClinicalNote={() => setClinicalNoteModalOpen(true)}
          onAmendNote={setAmendingNote}
          onEditProfile={()=>setProfileModalOpen(true)}
          onAddInstruction={()=>setInstructionModalOpen(true)}
          onInstructionStatus={changeInstructionStatus}
          onPrint={() => window.print()}
          originAppointmentId={location.state?.appointmentId||null}
          originRecordId={location.state?.recordId||null}
        />
      ) : (
        <>
          <section className="doctor-records-heading">
            <div>
              <span>Patient Directory</span>
              <h2>Patient Records</h2>
              <p>Search patients and access their complete clinical history.</p>
            </div>
            <div className="doctor-records-heading-icon" aria-hidden="true"><FaUserFriends /></div>
          </section>

          <section className="doctor-records-summary" aria-label="Directory summary">
            <article><div className="teal"><FaUserFriends /></div><p><strong>248</strong><span>Total Patients</span><small>Registered patients</small></p></article>
            <article><div className="blue"><FaFileMedical /></div><p><strong>2</strong><span>Visited Today</span><small>Current records</small></p></article>
            <article><div className="orange"><FaCalendarAlt /></div><p><strong>5</strong><span>Upcoming Visits</span><small>Next seven days</small></p></article>
            <article><div className="purple"><FaNotesMedical /></div><p><strong>1</strong><span>Pending Follow-up</span><small>Requires review</small></p></article>
          </section>

          <section className="doctor-records-toolbar">
            <div className="doctor-records-filters" role="tablist" aria-label="Patient directory filter">
              {filters.map((filter) => (
                <button type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? "active" : ""} key={filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>
              ))}
            </div>
            <label className="doctor-records-search">
              <FaSearch aria-hidden="true" />
              <span className="doctor-records-sr-only">Search patient directory</span>
              <input type="search" placeholder="Search name, patient ID or phone" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </label>
          </section>

          <section className="doctor-directory-panel">
            <div className="doctor-records-panel-heading">
              <div><span>Registered Patients</span><h3>Patient Directory</h3></div>
              <p>{filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"}</p>
            </div>

            <div className="doctor-directory-list">
              {filteredPatients.length > 0 ? filteredPatients.map((patient) => (
                <article className="doctor-directory-card" key={patient.id}>
                  <div className="doctor-directory-identity"><span className="doctor-record-avatar">{patient.initials}</span><p><small>Patient</small><strong>{patient.name}</strong><em>{patient.patientId}</em></p></div>
                  <div className="doctor-directory-detail"><small>Personal Details</small><strong>{patient.age} years · {patient.gender}</strong><span><FaPhoneAlt /> {patient.phone}</span></div>
                  <div className="doctor-directory-detail"><small>Last Visit</small><strong>{patient.lastVisit}</strong><span>{patient.lastTreatment}</span></div>
                  <div className="doctor-directory-detail"><small>Next Appointment</small><strong>{patient.nextAppointment}</strong><span>Scheduled visit</span></div>
                  <div className="doctor-directory-actions">
                    <span className={`doctor-record-status ${patient.status.toLowerCase().replace(" ", "-")}`}>
                      {patient.status}
                    </span>
                    <button type="button" className="doctor-view-patient" onClick={() => {setSelectedPatientId(patient.patientId);navigate(location.pathname,{replace:true,state:{...location.state,patientId:patient.patientId}});}}>
                      View Patient
                      <FaChevronRight />
                    </button>
                  </div>
                </article>
              )) : <div className="doctor-records-empty"><FaUserFriends /><h3>No patients found</h3><p>Try another filter or search term.</p></div>}
            </div>
          </section>
        </>
      )}
      {clinicalNoteModalOpen && selectedPatient && (
        <ClinicalRecordModal
          patient={selectedPatient}
          onClose={() => setClinicalNoteModalOpen(false)}
          onSave={saveClinicalRecord}
        />
      )}
      {amendingNote&&selectedPatient&&<AmendmentModal patient={selectedPatient} note={amendingNote} onClose={()=>setAmendingNote(null)} onSave={saveAmendment}/>} 
      {profileModalOpen&&selectedPatient&&<ClinicalProfileModal patient={selectedPatient} onClose={()=>setProfileModalOpen(false)} onSave={saveProfile}/>} 
      {instructionModalOpen&&selectedPatient&&<PatientInstructionModal patient={selectedPatient} onClose={()=>setInstructionModalOpen(false)} onSave={saveInstruction}/>} 
    </DoctorLayout>
  );
}

function PatientClinicalRecord({ patient, clinicalRecords, backLabel, onBack, onAddClinicalNote, onAmendNote, onEditProfile, onAddInstruction, onInstructionStatus, onPrint, originAppointmentId, originRecordId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "dental-chart", label: "Dental Chart" },
    { id: "clinical-images", label: "Clinical Images" },
    { id: "treatment-history", label: "Treatment History" },
  ];
  const requestedTab = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "overview";
  const selectTab = (tabId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabId === "overview") nextParams.delete("tab");
    else nextParams.set("tab", tabId);
    setSearchParams(nextParams);
  };
  const patientInformation = [
    ["IC / Passport", patient.identityNumber, <FaIdCard />],
    ["Date of Birth", patient.dateOfBirth, <FaCalendarAlt />],
    ["Gender", patient.gender, <FaUser />],
    ["Phone", patient.phone, <FaPhoneAlt />],
    ["Email", patient.email, <FaEnvelope />],
    ["Address", patient.address, <FaHome />],
  ];
  const clinicalInformation = [
    ["Medical History", patient.medicalHistory, <FaFileMedical />, "history"],
    ["Allergies", patient.allergies, <FaAllergies />, "allergies"],
    ["Current Medications", patient.medications, <FaPills />, "medications"],
    ["Diagnosis", patient.diagnosis, <FaTooth />, "diagnosis"],
    ["Clinical Notes", patient.clinicalNotes, <FaNotesMedical />, "notes"],
    ["Treatment Plan", patient.treatmentPlan, <FaClipboardList />, "treatment-plan"],
    ["Prescriptions", patient.prescriptions, <FaPills />, "prescriptions"],
  ];

  return (
    <div className="doctor-full-record">
      <header className="doctor-print-header"><h1>Klinik Pergigian Rosni Adam</h1><p>Patient Clinical Record</p></header>
      <section className="doctor-full-record-heading">
        <button className="doctor-record-back" type="button" onClick={onBack}><FaArrowLeft /> {backLabel}</button>
        <div className="doctor-record-hero-main">
          <div className="doctor-record-hero-avatar">{patient.initials}</div>
          <div className="doctor-record-hero-identity">
            <span>Full Clinical Record</span>
            <div><h2>{patient.name}</h2><span className={`doctor-record-status ${patient.status.toLowerCase().replace(" ", "-")}`}>{patient.status}</span></div>
            <p>{patient.patientId} · {patient.age} years · {patient.gender}</p>
          </div>
        </div>
        <div className="doctor-record-hero-details">
          <div><span><FaPhoneAlt /></span><p><small>Phone Number</small><strong>{patient.phone}</strong></p></div>
          <div><span><FaCalendarAlt /></span><p><small>Last Visit</small><strong>{patient.lastVisit}</strong></p></div>
          <div className="upcoming"><span><FaCalendarAlt /></span><p><small>Next Appointment</small><strong>{patient.nextAppointment}</strong></p></div>
        </div>
      </section>

      <nav className="doctor-record-tabs" role="tablist" aria-label="Patient record sections">
        {tabs.map((tab) => <button key={tab.id} id={`doctor-record-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="doctor-record-tab-content" onClick={() => selectTab(tab.id)}>{tab.label}</button>)}
      </nav>

      <section className="doctor-full-record-actions">
        <div><span>Clinical Actions</span><small>Update and manage this patientâ€™s care</small></div>
        <button type="button" className="primary" onClick={onAddClinicalNote}><FaNotesMedical /> Add Clinical Note</button>
        <button type="button" onClick={onAddInstruction}><FaClipboardList /> Patient Instruction</button>
        <button type="button" onClick={onPrint}><FaPrint /> Print Record</button>
      </section>

      <section id="doctor-record-tab-content" className="doctor-full-record-grid" role="tabpanel" aria-labelledby={`doctor-record-tab-${activeTab}`}>
        <article hidden={activeTab !== "overview"} className="doctor-record-section-card doctor-encounter-timeline-card">
          <div className="doctor-record-section-heading"><div><FaCalendarAlt /></div><span><small>Clinical Workspace</small><h3>Encounter Timeline</h3></span></div>
          <div className="doctor-encounter-timeline">{patient.encounters?.length?patient.encounters.map((encounter)=><article key={encounter.recordId}><time>{encounter.date}</time><div><strong>{encounter.service}</strong><span>{encounter.doctor}</span><small>{encounter.recordId}{encounter.appointmentId?` · ${encounter.appointmentId}`:""}</small></div></article>):<p>No clinical encounters recorded.</p>}</div>
        </article>
        <article hidden={activeTab !== "dental-chart"} className="doctor-record-section-card doctor-treatment-history-card"><DentalChart patientId={patient.patientId} originAppointmentId={originAppointmentId} originRecordId={originRecordId} historyOutside/></article>
        <article hidden={activeTab !== "clinical-images"} className="doctor-record-section-card doctor-treatment-history-card"><ClinicalImages patientId={patient.patientId} encounters={patient.encounters||[]} originAppointmentId={originAppointmentId} originRecordId={originRecordId}/></article>
        <article hidden={activeTab !== "overview"} className="doctor-record-section-card">
          <div className="doctor-record-section-heading"><div><FaUser /></div><span><small>Patient Profile</small><h3>Patient Information</h3></span></div>
          <div className="doctor-information-grid">{patientInformation.map(([label, value, icon]) => <div className="doctor-information-item" key={label}><span>{icon}</span><p><small>{label}</small><strong>{value}</strong></p></div>)}</div>
        </article>

        <article hidden={activeTab !== "overview"} className="doctor-record-section-card">
          <div className="doctor-record-section-heading"><div><FaFileMedical /></div><span><small>Health Details</small><h3>Clinical Information</h3></span><button type="button" onClick={onEditProfile}>Edit</button></div>
          <div className="doctor-clinical-grid">{clinicalInformation.map(([label, value, icon, modifier]) => <div className={`doctor-clinical-item ${modifier}`} key={label}><span>{icon}</span><p><small>{label}</small><strong>{value}</strong></p></div>)}</div>
        </article>

        <article hidden={activeTab !== "treatment-history"} className="doctor-record-section-card doctor-treatment-history-card">
          <div className="doctor-record-section-heading"><div><FaTooth /></div><span><small>Previous Care</small><h3>Treatment History</h3></span></div>
          <div className="doctor-treatment-table">
            <div className="doctor-treatment-table-header"><span>Date</span><span>Treatment</span><span>Doctor</span><span>Diagnosis & Notes</span><span>Status</span></div>
            {[...clinicalRecords, ...patient.treatments].map((treatment) => {const status=treatment.status||"Recorded";return <div className="doctor-treatment-table-row" key={`${treatment.status?"treatment":"note"}-${treatment.id || `${treatment.date}-${treatment.treatment}`}`}><strong data-label="Date">{treatment.date}</strong><strong data-label="Treatment">{treatment.treatment}</strong><span data-label="Doctor">{treatment.doctor}</span><p data-label="Diagnosis & Notes"><strong>{treatment.diagnosis}</strong><small>{treatment.procedure && <><b>Procedure:</b> {treatment.procedure}<br /></>}{treatment.clinicalNote || treatment.notes}{treatment.prescription && <><br /><b>Prescription:</b> {treatment.prescription}</>}</small></p><span className={`doctor-record-status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span></div>;})}
          </div>
        </article>

        <article hidden={activeTab !== "treatment-history"} className="doctor-record-section-card doctor-clinical-note-history-card">
          <div className="doctor-record-section-heading"><div><FaNotesMedical /></div><span><small>Session Updates</small><h3>Clinical Notes History</h3></span></div>
          {clinicalRecords.length > 0 ? (
            <div className="doctor-clinical-note-history">
              {clinicalRecords.map((note) => (
                <article className="doctor-clinical-note-entry" key={note.id}>
                  <div className="doctor-clinical-note-entry-heading"><div><span>{note.date}</span><strong>{note.treatment}</strong></div><small>{note.doctor}</small><button type="button" onClick={()=>onAmendNote(note)}>Amend</button></div>
                  {note.supersedesNoteId&&<p><strong>Amendment of note #{note.supersedesNoteId}</strong> — {note.amendmentReason}</p>}
                  <div className="doctor-clinical-note-entry-grid">
                    <div><span>Diagnosis</span><p>{note.diagnosis}</p></div>
                    <div><span>Clinical Note</span><p>{note.clinicalNote}</p></div>
                    <div><span>Treatment / Procedure Performed</span><p>{note.procedure}</p></div>
                    <div><span>Prescription</span><p>{note.prescription}</p></div>
                    <div className="follow-up"><span>Follow-up</span><p>{note.followUp}</p></div>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="doctor-clinical-note-empty"><FaNotesMedical /><p>No new clinical notes added during this session.</p></div>}
        </article>

        <article hidden={activeTab !== "overview"} className="doctor-record-section-card doctor-patient-instructions-card">
          <div className="doctor-record-section-heading"><div><FaClipboardList /></div><span><small>Patient-visible Communication</small><h3>Patient Instructions</h3></span><button type="button" onClick={onAddInstruction}>Create Draft</button></div>
          <div className="doctor-patient-instructions">{patient.instructions?.length?patient.instructions.map((instruction)=><article key={instruction.id}><header><div><span>{instruction.type}</span><strong>{instruction.title}</strong></div><span className={`instruction-status ${instruction.status.toLowerCase()}`}>{instruction.status}</span></header><p>{instruction.content}</p><small>{instruction.doctor} · {instruction.recordId}</small><footer>{instruction.status==="Draft"&&<button type="button" onClick={()=>onInstructionStatus(instruction,"publish")}>Publish to Patient</button>}{instruction.status==="Published"&&<button type="button" className="danger" onClick={()=>onInstructionStatus(instruction,"withdraw")}>Withdraw</button>}{instruction.status==="Withdrawn"&&<span>Retained in communication history</span>}</footer></article>):<div className="doctor-clinical-note-empty"><FaClipboardList/><p>No Patient-facing instructions created.</p></div>}</div>
        </article>

        <article hidden={activeTab !== "overview"} className="doctor-record-section-card doctor-appointments-card">
          <div className="doctor-record-section-heading"><div><FaCalendarAlt /></div><span><small>Visit Schedule</small><h3>Appointments</h3></span></div>
          <div className="doctor-record-appointment-list"><div><span className="doctor-appointment-summary-icon"><FaCalendarAlt /></span><p><span>Previous Appointment</span><strong>{patient.appointments.previous}</strong></p></div><div className="upcoming"><span className="doctor-appointment-summary-icon"><FaChevronRight /></span><p><span>Upcoming Appointment</span><strong>{patient.appointments.upcoming}</strong></p></div></div>
        </article>
      </section>
    </div>
  );
}

function PatientInstructionModal({patient,onClose,onSave}){
  const[form,setForm]=useState({recordId:patient.encounters?.[0]?.recordId||"",type:"General Care",title:"",content:""});const[error,setError]=useState("");
  async function submit(event){event.preventDefault();setError("");try{await onSave(form);}catch(requestError){setError(requestError.message);}}
  return <div className="doctor-treatment-modal-overlay" onMouseDown={onClose}><section className="doctor-treatment-modal" role="dialog" aria-modal="true" onMouseDown={(event)=>event.stopPropagation()}><header className="doctor-treatment-modal-header"><div><FaClipboardList/></div><span><small>Patient-visible Draft</small><h2>Create Patient Instruction</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes/></button></header><div className="doctor-treatment-patient"><div><span>Patient</span><strong>{patient.name}</strong><small>{patient.patientId}</small></div></div><form className="doctor-treatment-form" onSubmit={submit}><label><span>Clinical Encounter *</span><select value={form.recordId} onChange={(event)=>setForm({...form,recordId:event.target.value})} required><option value="">Select encounter</option>{patient.encounters?.map((encounter)=><option value={encounter.recordId} key={encounter.recordId}>{encounter.date} · {encounter.service}</option>)}</select></label><label><span>Instruction Type *</span><select value={form.type} onChange={(event)=>setForm({...form,type:event.target.value})}><option>Medication</option><option>Follow-up</option><option>General Care</option></select></label><label className="wide"><span>Title *</span><input value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})} required maxLength="180"/></label><label className="wide"><span>Patient Instruction *</span><textarea rows="6" value={form.content} onChange={(event)=>setForm({...form,content:event.target.value})} required maxLength="10000"/></label><p className="wide">This is saved as Draft. It is not visible to the Patient until you publish it intentionally.</p>{error&&<p className="wide" role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save Draft</button></footer></form></section></div>;
}

function ClinicalRecordModal({ patient, onClose, onSave }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ treatment: "", status: "Planned", diagnosis: "", procedure: "", clinicalNote: "", prescription: "", followUp: "" });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const currentDate = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date()),
    []
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submitClinicalRecord(event) {
    event.preventDefault();
    const nextErrors = Object.fromEntries(Object.entries(form).filter(([, value]) => !value.trim()).map(([field]) => [field, "This field is required."]));
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setRequestError("");
    setSubmitting(true);
    try {
      await onSave({ id: `record-${Date.now()}`, date: currentDate, doctor: user?.fullName, ...form });
      setSaved(true);
    } catch (error) {
      setRequestError(error.message || "The clinical note could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="doctor-treatment-modal-overlay" onMouseDown={onClose}>
      <section className="doctor-treatment-modal" role="dialog" aria-modal="true" aria-labelledby="treatment-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        {saved ? (
          <div className="doctor-treatment-success"><div><FaCheck /></div><span>Clinical Record Saved</span><h2>Patient record updated</h2><p>The new entry was added to {patient.name}â€™s clinical notes and treatment history.</p><button type="button" onClick={onClose}>Done</button></div>
        ) : (
          <>
            <header className="doctor-treatment-modal-header"><div><FaNotesMedical /></div><span><small>Patient Clinical Record</small><h2 id="treatment-modal-title">Add Clinical Note</h2></span><button type="button" onClick={onClose} aria-label="Close clinical note modal"><FaTimes /></button></header>
            <div className="doctor-treatment-patient"><div><span>Patient</span><strong>{patient.name}</strong><small>{patient.patientId}</small></div><div><span>Doctor</span><strong>{user?.fullName}</strong></div><div><span>Date</span><strong>{currentDate}</strong></div></div>
            <form className="doctor-treatment-form" onSubmit={submitClinicalRecord} noValidate>
              <label><span>Treatment / Service *</span><input name="treatment" value={form.treatment} onChange={updateField} placeholder="Enter treatment or service" aria-invalid={Boolean(errors.treatment)} />{errors.treatment && <small>{errors.treatment}</small>}</label>
              <label><span>Treatment Status *</span><select name="status" value={form.status} onChange={updateField}><option>Planned</option><option>In Progress</option><option>Completed</option><option>Follow-up Required</option></select></label>
              <label><span>Diagnosis *</span><textarea name="diagnosis" rows="2" value={form.diagnosis} onChange={updateField} placeholder="Enter diagnosis" aria-invalid={Boolean(errors.diagnosis)} />{errors.diagnosis && <small>{errors.diagnosis}</small>}</label>
              <label><span>Treatment / Procedure Performed *</span><textarea name="procedure" rows="2" value={form.procedure} onChange={updateField} placeholder="Describe the procedure or treatment" aria-invalid={Boolean(errors.procedure)} />{errors.procedure && <small>{errors.procedure}</small>}</label>
              <label><span>Clinical Note *</span><textarea name="clinicalNote" rows="3" value={form.clinicalNote} onChange={updateField} placeholder="Add clinical observations" aria-invalid={Boolean(errors.clinicalNote)} />{errors.clinicalNote && <small>{errors.clinicalNote}</small>}</label>
              <label><span>Prescription *</span><textarea name="prescription" rows="2" value={form.prescription} onChange={updateField} placeholder="Enter prescription or None" aria-invalid={Boolean(errors.prescription)} />{errors.prescription && <small>{errors.prescription}</small>}</label>
              <label><span>Follow-up Recommendation *</span><textarea name="followUp" rows="2" value={form.followUp} onChange={updateField} placeholder="Enter recommended follow-up" aria-invalid={Boolean(errors.followUp)} />{errors.followUp && <small>{errors.followUp}</small>}</label>
              {requestError && <p role="alert">{requestError}</p>}
              <footer><button type="button" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" className="primary" disabled={submitting}><FaNotesMedical /> {submitting ? "Saving…" : "Save Clinical Note"}</button></footer>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function AmendmentModal({patient,note,onClose,onSave}){
  const[form,setForm]=useState({treatment:note.treatment||"",diagnosis:note.diagnosis||"",procedure:note.procedure||"",clinicalNote:note.clinicalNote||"",prescription:note.prescription||"",followUp:note.followUp||"",amendmentReason:""});const[error,setError]=useState("");
  async function submit(event){event.preventDefault();if(form.amendmentReason.trim().length<2){setError("An amendment reason is required.");return;}try{await onSave(form);onClose();}catch(requestError){setError(requestError.message);}}
  return <div className="doctor-treatment-modal-overlay" onMouseDown={onClose}><section className="doctor-treatment-modal" role="dialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()}><header className="doctor-treatment-modal-header"><div><FaNotesMedical/></div><span><small>Original note #{note.id} remains unchanged</small><h2>Amend Clinical Note</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes/></button></header><div className="doctor-treatment-patient"><div><span>Patient</span><strong>{patient.name}</strong><small>{patient.patientId}</small></div><div><span>Original Note</span><strong>{note.date}</strong></div></div><form className="doctor-treatment-form" onSubmit={submit}>{[["treatment","Treatment / Service"],["diagnosis","Diagnosis"],["procedure","Treatment / Procedure Performed"],["clinicalNote","Clinical Note"],["prescription","Prescription"],["followUp","Follow-up Recommendation"]].map(([name,label])=><label key={name}><span>{label} *</span>{name==="treatment"?<input name={name} value={form[name]} onChange={e=>setForm({...form,[name]:e.target.value})} required/>:<textarea name={name} rows="2" value={form[name]} onChange={e=>setForm({...form,[name]:e.target.value})} required/>}</label>)}<label><span>Amendment Reason *</span><textarea rows="2" value={form.amendmentReason} onChange={e=>{setForm({...form,amendmentReason:e.target.value});setError("");}} required/>{error&&<small role="alert">{error}</small>}</label><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Create Amendment</button></footer></form></section></div>;
}

function ClinicalProfileModal({patient,onClose,onSave}){
  const[form,setForm]=useState({medicalHistory:patient.medicalHistory||"",allergies:patient.allergies||"",medications:patient.medications||""});const[error,setError]=useState("");
  async function submit(event){event.preventDefault();try{await onSave(form);}catch(requestError){setError(requestError.message);}}
  return <div className="doctor-treatment-modal-overlay" onMouseDown={onClose}><section className="doctor-treatment-modal" role="dialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()}><header className="doctor-treatment-modal-header"><div><FaFileMedical/></div><span><small>Encrypted Patient Health Profile</small><h2>Edit Clinical Profile</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes/></button></header><div className="doctor-treatment-patient"><div><span>Patient</span><strong>{patient.name}</strong><small>{patient.patientId}</small></div></div><form className="doctor-treatment-form" onSubmit={submit}>{[["medicalHistory","Medical History"],["allergies","Allergies"],["medications","Current Medications"]].map(([name,label])=><label key={name}><span>{label} *</span><textarea rows="3" value={form[name]} onChange={e=>setForm({...form,[name]:e.target.value})} required/></label>)}{error&&<p role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save Clinical Profile</button></footer></form></section></div>;
}

export default DoctorPatientRecords;
