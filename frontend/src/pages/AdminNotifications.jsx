import { useNavigate } from "react-router-dom";
import NotificationView from "../components/notifications/NotificationView";
import AdminLayout from "../components/admin/AdminLayout";
import { useNotifications } from "../context/useNotifications";
import "../styles/PatientNotifications.css";
import "../styles/AdminNotifications.css";

function AdminNotifications(){
  const navigate=useNavigate();const{getNotifications,getUnreadCount,markAsRead,markAllAsRead}=useNotifications();const items=getNotifications("Admin");const unread=getUnreadCount("Admin");
  return <AdminLayout activePage="notifications" pageTitle="Notifications" pageSubtitle="Admin Portal · Klinik Pergigian Rosni Adam"><NotificationView label="Admin Updates" description="Stay informed about booking operations, registrations, and system activity." items={items} unread={unread} onMarkRead={(id)=>markAsRead("Admin",id)} onMarkAll={()=>markAllAsRead("Admin")} onOpen={(item)=>navigate(item.relatedRoute,{state:{relatedEntityId:item.relatedEntityId}})}/></AdminLayout>;
}
export default AdminNotifications;
