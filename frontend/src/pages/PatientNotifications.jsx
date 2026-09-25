import { useNavigate } from "react-router-dom";
import NotificationView from "../components/notifications/NotificationView";
import PatientLayout from "../components/patient/PatientLayout";
import { useNotifications } from "../context/useNotifications";
import "../styles/PatientNotifications.css";

function PatientNotifications(){
  const navigate=useNavigate();const{getNotifications,getUnreadCount,markAsRead,markAllAsRead}=useNotifications();const items=getNotifications("Patient");const unread=getUnreadCount("Patient");
  return <PatientLayout activePage="notifications" pageTitle="Notifications"><NotificationView label="Patient Updates" description="Stay informed about appointments and recent dental activity." items={items} unread={unread} onMarkRead={(id)=>markAsRead("Patient",id)} onMarkAll={()=>markAllAsRead("Patient")} onOpen={(item)=>navigate(item.relatedRoute,{state:{relatedEntityId:item.relatedEntityId}})}/></PatientLayout>;
}
export default PatientNotifications;
