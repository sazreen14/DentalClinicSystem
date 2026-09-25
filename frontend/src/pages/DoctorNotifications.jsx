import { useNavigate } from "react-router-dom";
import NotificationView from "../components/notifications/NotificationView";
import DoctorLayout from "../components/doctor/DoctorLayout";
import { useNotifications } from "../context/useNotifications";
import "../styles/PatientNotifications.css";
import "../styles/DoctorNotifications.css";

function DoctorNotifications(){
  const navigate=useNavigate();const{getNotifications,getUnreadCount,markAsRead,markAllAsRead}=useNotifications();const items=getNotifications("Doctor");const unread=getUnreadCount("Doctor");
  return <DoctorLayout activePage="notifications" pageTitle="Notifications" pageSubtitle="Doctor Portal · Klinik Pergigian Rosni Adam"><NotificationView label="Doctor Updates" description="Stay informed about appointments, follow-ups, and schedule activity." items={items} unread={unread} onMarkRead={(id)=>markAsRead("Doctor",id)} onMarkAll={()=>markAllAsRead("Doctor")} onOpen={(item)=>navigate(item.relatedRoute,{state:{relatedEntityId:item.relatedEntityId}})}/></DoctorLayout>;
}
export default DoctorNotifications;
