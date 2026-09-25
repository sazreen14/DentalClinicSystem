import { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaClipboardList, FaPills, FaSearch, FaShieldAlt, FaStethoscope, FaUserMd } from "react-icons/fa";
import PatientLayout from "../components/patient/PatientLayout";
import { getPatientRecord } from "../services/clinicalRecordsApi";
import "../styles/PatientRecords.css";

const typeIcon={Medication:<FaPills/>,"Follow-up":<FaStethoscope/>,"General Care":<FaClipboardList/>};
const displayDate=(value)=>value?new Date(value).toLocaleDateString("en-MY",{day:"numeric",month:"long",year:"numeric"}):"Published care information";

export default function PatientRecords(){
  const[care,setCare]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[search,setSearch]=useState("");
  useEffect(()=>{getPatientRecord().then(setCare).catch((requestError)=>setError(requestError.message)).finally(()=>setLoading(false));},[]);
  const instructions=useMemo(()=>care?.instructions||[],[care]);
  const visible=instructions.filter((item)=>`${item.type} ${item.title} ${item.content} ${item.doctor}`.toLowerCase().includes(search.trim().toLowerCase()));
  const counts={all:instructions.length,medication:instructions.filter((item)=>item.type==="Medication").length,followUp:instructions.filter((item)=>item.type==="Follow-up").length};
  return <PatientLayout activePage="records" pageTitle="My Care">
    <section className="figma-records-heading"><div><span>Care Information</span><h2>My Care</h2><p>Review instructions your Doctor has intentionally published for you.</p></div><div className="figma-records-heading-icon"><FaClipboardList/></div></section>
    {loading&&<p role="status">Loading care information…</p>}{!loading&&error&&<p role="alert">Care information could not be loaded: {error}</p>}
    {!loading&&!error&&<><section className="figma-records-stat-grid" aria-label="Care information summary"><article className="figma-records-stat-card"><div className="figma-records-stat-icon teal"><FaClipboardList/></div><div><strong>{counts.all}</strong><span>Published Instructions</span><small>Visible to you</small></div></article><article className="figma-records-stat-card"><div className="figma-records-stat-icon blue"><FaPills/></div><div><strong>{counts.medication}</strong><span>Medication</span><small>Prescription guidance</small></div></article><article className="figma-records-stat-card"><div className="figma-records-stat-icon purple"><FaStethoscope/></div><div><strong>{counts.followUp}</strong><span>Follow-up</span><small>Care recommendations</small></div></article></section><section className="figma-records-section"><header className="figma-records-section-heading"><div><span>Published by your clinic</span><h3>Care Instructions</h3></div><label className="figma-records-search"><FaSearch aria-hidden="true"/><span className="figma-records-sr-only">Search care instructions</span><input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search instructions"/></label></header><div className="figma-records-list patient-care-list">{visible.map((item)=><article className="patient-care-card" key={item.id}><header className="patient-care-card-header"><span className="patient-care-type">{typeIcon[item.type]} {item.type}</span><span className="patient-care-published">Published</span></header><div className="patient-care-main"><h4>{item.title}</h4><div className="patient-care-meta"><span><FaUserMd/>{item.doctor}</span><span><FaCalendarAlt/>{displayDate(item.publishedAt)}</span></div><div className="patient-care-content">{item.content}</div></div></article>)}{!visible.length&&<div className="patient-care-empty"><FaClipboardList/><h3>{instructions.length?"No matching instructions":"No published care instructions"}</h3><p>{instructions.length?"Try another search term.":"Your Doctor has not published any Patient-facing instructions yet."}</p><small><FaShieldAlt/> Internal clinical notes are not displayed in the Patient portal.</small></div>}</div></section></>}
  </PatientLayout>;
}
