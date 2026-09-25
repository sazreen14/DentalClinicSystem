import { FaBell,FaCalendarAlt,FaCalendarCheck,FaCalendarTimes,FaCheck,FaCheckCircle,FaClock,FaCog,FaEnvelope,FaExclamationTriangle,FaTooth,FaUserClock,FaUserPlus,FaUsers } from "react-icons/fa";

const iconByType={
  "appointment-confirmed":<FaCalendarCheck />,"appointment-reminder":<FaCalendarAlt />,"appointment-cancelled":<FaCalendarTimes />,
  "record-updated":<FaTooth />,email:<FaEnvelope />,"new-appointment":<FaCalendarAlt />,"upcoming-appointment":<FaClock />,
  "follow-up-reminder":<FaUserClock />,"schedule-update":<FaCalendarAlt />,"pending-appointment":<FaCalendarAlt />,
  "reschedule-request":<FaCalendarAlt />,"new-patient":<FaUserPlus />,"new-user":<FaUsers />,"clinic-operations":<FaCog />,"security-alert":<FaExclamationTriangle />,
};

export default function NotificationView({label,description,items,unread,onMarkRead,onMarkAll,onOpen}){
  async function open(item){await onMarkRead(item.id);if(item.relatedRoute)onOpen(item);}
  return <>
    <section className="figma-notifications-heading"><div><span>{label}</span><h2>Notifications</h2><p>{description}</p></div><div className="figma-notifications-heading-icon" aria-hidden="true"><FaBell/></div></section>
    <section className="figma-notifications-section">
      <div className="figma-notifications-section-heading"><div><span>Recent Activity</span><h3>Your Notifications</h3></div><div className="figma-notifications-summary"><p><strong>{unread}</strong> unread</p>{unread>0&&<button type="button" onClick={onMarkAll}><FaCheck/> Mark all as read</button>}</div></div>
      <div className="figma-notifications-list">{items.map((item)=><article key={item.id} className={`figma-notification-card ${item.read?'read':'unread'} ${item.relatedRoute?'clickable':''}`} onClick={()=>open(item)} onKeyDown={(event)=>{if(item.relatedRoute&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open(item);}}} tabIndex={item.relatedRoute?0:undefined}>
        <div className="figma-notification-icon" aria-hidden="true">{iconByType[item.type]||<FaBell/>}</div>
        <div className="figma-notification-content"><div className="figma-notification-title-row"><div><h3>{item.title}</h3>{!item.read&&<span className="figma-notification-unread-label">New</span>}</div><time>{item.timestamp}</time></div><p>{item.message}</p></div>
        <div className="figma-notification-action">{!item.read?<button type="button" onClick={(event)=>{event.stopPropagation();onMarkRead(item.id);}}><FaCheck/> Mark as read</button>:<span><FaCheckCircle/> Read</span>}</div>
      </article>)}</div>
    </section>
  </>;
}
