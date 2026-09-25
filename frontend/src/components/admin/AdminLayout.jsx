import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { useAuth } from "../../context/useAuth";
import "../../styles/AdminLayout.css";
function AdminLayout({activePage="overview",pageTitle="Overview",pageSubtitle="Admin Portal · Klinik Pergigian Rosni Adam",children}){
 const {user}=useAuth(); const adminName=user?.fullName||"Clinic Admin"; const adminInitials=adminName.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase();
 const[sidebarOpen,setSidebarOpen]=useState(false);
 return <div className="admin-layout"><div className={`admin-sidebar-wrapper ${sidebarOpen?'open':''}`}><AdminSidebar activePage={activePage} adminName={adminName} adminInitials={adminInitials}/></div>{sidebarOpen&&<button type="button" className="admin-sidebar-overlay" onClick={()=>setSidebarOpen(false)} aria-label="Close admin menu"/>}<div className="admin-content"><AdminTopbar title={pageTitle} subtitle={pageSubtitle} adminName={adminName} adminInitials={adminInitials} onToggleSidebar={()=>setSidebarOpen((value)=>!value)}/><main className="admin-page">{children}</main></div></div>;
}
export default AdminLayout;
