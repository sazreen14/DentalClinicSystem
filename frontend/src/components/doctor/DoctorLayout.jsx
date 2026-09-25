import { useState } from "react";
import DoctorSidebar from "./DoctorSidebar";
import DoctorTopbar from "./DoctorTopbar";
import { useAuth } from "../../context/useAuth";
import { useIdentity } from "../../context/useIdentity";
import "../../styles/DoctorLayout.css";
function DoctorLayout({activePage="overview",pageTitle="Overview",pageSubtitle="Doctor Portal · Klinik Pergigian Rosni Adam",doctorName="Dr. Rosni Adam",doctorInitials="RA",children}){
 const {user}=useAuth(); const {doctorProfile}=useIdentity(); const displayedName=doctorProfile?.fullName||user?.fullName||doctorName; const displayedInitials=displayedName.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase()||doctorInitials; const photoUrl=doctorProfile?.photoUrl||null;
 const[mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
 return <div className="doctor-layout"><div className={`doctor-sidebar-wrapper ${mobileSidebarOpen?'open':''}`}><DoctorSidebar activePage={activePage} doctorName={displayedName} doctorInitials={displayedInitials} doctorPhotoUrl={photoUrl}/></div>{mobileSidebarOpen&&<button type="button" className="doctor-sidebar-overlay" onClick={()=>setMobileSidebarOpen(false)} aria-label="Close doctor menu"/>}<div className="doctor-content"><DoctorTopbar title={pageTitle} subtitle={pageSubtitle} doctorName={displayedName} doctorInitials={displayedInitials} doctorPhotoUrl={photoUrl} onToggleSidebar={()=>setMobileSidebarOpen((value)=>!value)}/><main className="doctor-page">{children}</main></div></div>;
}
export default DoctorLayout;
