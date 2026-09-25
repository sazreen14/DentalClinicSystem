import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../services/apiClient";
import { useAuth } from "./useAuth";
import { AppointmentsContext } from "./useAppointments";

const listPath={Patient:'/appointments/my',Doctor:'/doctor/appointments',Admin:'/admin/appointments'};
function apiTime(value){if(/^\d{2}:\d{2}$/.test(value))return value;const match=value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!match)return value;let hour=Number(match[1])%12;if(match[3].toUpperCase()==='PM')hour+=12;return `${String(hour).padStart(2,'0')}:${match[2]}`;}
export function AppointmentsProvider({children}){
  const {user,isAuthenticated}=useAuth();
  const role=user?.role;
  const [appointments,setAppointments]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const refreshAppointments=useCallback(async()=>{
    if(!isAuthenticated||!listPath[role]){setAppointments([]);return [];}
    setLoading(true);setError('');
    try{const data=await apiRequest(listPath[role]);setAppointments(data.appointments||[]);return data.appointments||[];}
    catch(e){setError(e.message);throw e;} finally{setLoading(false);}
  },[isAuthenticated,role]);
  useEffect(()=>{queueMicrotask(()=>refreshAppointments().catch(()=>{}));},[refreshAppointments]);
  const mutate=useCallback(async(path,body)=>{const data=await apiRequest(path,{method:'POST',body:body?JSON.stringify(body):undefined});setAppointments(items=>items.map(x=>x.id===data.appointment.id?data.appointment:x));return data.appointment;},[]);
  const addAppointment=useCallback(async(input)=>{const data=await apiRequest('/appointments',{method:'POST',body:JSON.stringify(input)});setAppointments(items=>[data.appointment,...items]);return data.appointment;},[]);
  const adminAddAppointment=useCallback(async(input)=>{const data=await apiRequest('/admin/appointments',{method:'POST',body:JSON.stringify(input)});setAppointments(items=>[data.appointment,...items]);return data.appointment;},[]);
  const adminAddAppointmentForNewPatient=useCallback(async(input)=>{const data=await apiRequest('/admin/appointments/new-patient',{method:'POST',body:JSON.stringify(input)});setAppointments(items=>[data.appointment,...items]);return data.appointment;},[]);
  const cancelAppointment=useCallback((id,{reason})=>mutate(`/appointments/${id}/cancel`,{reason}),[mutate]);
  const patientRescheduleAppointment=useCallback((id,{date,time,reason=''})=>mutate(`/appointments/${id}/reschedule`,{date,time:apiTime(time),reason}),[mutate]);
  const confirmAppointment=useCallback((id)=>mutate(`/admin/appointments/${id}/confirm`),[mutate]);
  const rescheduleAppointment=useCallback((id,{date,time,reason=''})=>mutate(`/admin/appointments/${id}/reschedule`,{date,time:apiTime(time),reason}),[mutate]);
  const adminCancelAppointment=useCallback((id,{reason})=>mutate(`/admin/appointments/${id}/cancel`,{reason}),[mutate]);
  const getBookingOptions=useCallback(()=>apiRequest('/appointments/options'),[]);
  const getAdminBookingOptions=useCallback(()=>apiRequest('/admin/appointments/options'),[]);
  const getAvailability=useCallback(({doctorId,date,serviceId})=>apiRequest(`/appointments/availability?${new URLSearchParams({doctorId,date,serviceId})}`).then(x=>x.availability),[]);
  const value=useMemo(()=>({appointments,loading,error,refreshAppointments,addAppointment,adminAddAppointment,adminAddAppointmentForNewPatient,cancelAppointment,patientRescheduleAppointment,confirmAppointment,rescheduleAppointment,adminCancelAppointment,getBookingOptions,getAdminBookingOptions,getAvailability}),[appointments,loading,error,refreshAppointments,addAppointment,adminAddAppointment,adminAddAppointmentForNewPatient,cancelAppointment,patientRescheduleAppointment,confirmAppointment,rescheduleAppointment,adminCancelAppointment,getBookingOptions,getAdminBookingOptions,getAvailability]);
  return <AppointmentsContext.Provider value={value}>{children}</AppointmentsContext.Provider>;
}
