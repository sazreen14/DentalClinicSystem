import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import NotificationPreferencesStatus from "../components/NotificationPreferencesStatus";
import { useState } from "react";
import { changePassword } from "../services/authApi";
import { FaBell,FaLock,FaShieldAlt,FaSignOutAlt,FaSlidersH,FaUser } from "react-icons/fa";
import DoctorLayout from "../components/doctor/DoctorLayout";
import { Actions,Feedback,Field,Panel,PanelFooter,Rows,Session,SettingsShell,ToggleRow } from "./PatientSettings";
import "../styles/SettingsShared.css";
import "../styles/DoctorSettings.css";
const tabs=[['account','Account',<FaUser/>],['notifications','Notifications',<FaBell/>],['security','Security',<FaLock/>],['privacy','Privacy',<FaShieldAlt/>],['sessions','Sessions',<FaSignOutAlt/>]];
function DoctorSettings(){
 const[active,setActive]=useState('account');const[message,setMessage]=useState('');const[profile,setProfile]=useState({name:'Dr. Rosni Adam',email:'rosni.adam@klinikpergigian.my',title:'Dental Surgeon',license:'MDC-RA-2014-0872'});const notifications=useNotificationPreferences();const{prefs,setPrefs}=notifications;const[privacy,setPrivacy]=useState(true);const[passwords,setPasswords]=useState({current:'',next:'',confirm:''});const[savingPassword,setSavingPassword]=useState(false);
 async function savePassword(e){
  e.preventDefault();if(savingPassword)return;setMessage('');
  if(passwords.next!==passwords.confirm){setMessage('New password and confirmation do not match.');return;}
  setSavingPassword(true);
  try{await changePassword({currentPassword:passwords.current,newPassword:passwords.next,confirmPassword:passwords.confirm});setPasswords({current:'',next:'',confirm:''});setMessage('Password updated successfully.');}
  catch(error){setMessage(error.message||'Password could not be updated.');}
  finally{setSavingPassword(false);}
 }
 return <DoctorLayout activePage="settings" pageTitle="Settings" pageSubtitle="Manage your account and portal preferences" doctorName="Dr. Rosni Adam" doctorInitials="RA">
  <section className="portal-settings-heading"><div><span>Account Preferences</span><h2>Settings</h2><p>Manage your doctor account and portal preferences.</p></div><div><FaSlidersH/></div></section>{message&&<Feedback text={message} close={()=>setMessage('')}/>}<SettingsShell tabs={tabs} active={active} setActive={setActive}>
   {active==='account'&&<Panel title="Account Settings" text="Update your professional account information." icon={<FaUser/>}><form className="portal-settings-form" onSubmit={(e)=>{e.preventDefault();setMessage('Account settings saved.')}}><Field label="Full Name" value={profile.name} set={(v)=>setProfile({...profile,name:v})}/><Field label="Email" type="email" value={profile.email} set={(v)=>setProfile({...profile,email:v})}/><Field label="Professional Title" value={profile.title} set={(v)=>setProfile({...profile,title:v})}/><Field label="Registration / License" value={profile.license} set={(v)=>setProfile({...profile,license:v})}/><Actions label="Save Changes"/></form></Panel>}
   {active==='notifications'&&<Panel title="Notification Preferences" text="Choose which clinical and schedule updates you receive." icon={<FaBell/>}><NotificationPreferencesStatus state={notifications}/><Rows><ToggleRow disabled={notifications.disabled} title="Appointment Notifications" text="Receive alerts for scheduled patient appointments." checked={prefs.appointments ?? false} toggle={()=>setPrefs({...prefs,appointments:!prefs.appointments})}/><ToggleRow disabled={notifications.disabled} title="Patient Follow-up Reminders" text="Be notified when a patient follow-up is due." checked={prefs.followUps ?? false} toggle={()=>setPrefs({...prefs,followUps:!prefs.followUps})}/><ToggleRow disabled={notifications.disabled} title="System Notifications" text="Receive important clinical and account activity alerts." checked={prefs.system ?? false} toggle={()=>setPrefs({...prefs,system:!prefs.system})}/></Rows><PanelFooter action={notifications.save} disabled={notifications.disabled} label={notifications.saving?'Saving...':'Save Notifications'}/></Panel>}
   {active==='security'&&<Panel title="Security" text="Change your password." icon={<FaLock/>}><form className="portal-settings-form" onSubmit={savePassword}><Field label="Current Password" type="password" disabled={savingPassword} value={passwords.current} set={(v)=>setPasswords({...passwords,current:v})}/><Field label="New Password" type="password" disabled={savingPassword} value={passwords.next} set={(v)=>setPasswords({...passwords,next:v})}/><Field label="Confirm New Password" type="password" disabled={savingPassword} value={passwords.confirm} set={(v)=>setPasswords({...passwords,confirm:v})}/><Actions label={savingPassword?'Saving...':'Save Security'} disabled={savingPassword}/></form></Panel>}
   {active==='privacy'&&<Panel title="Privacy Preferences" text="Manage professional account-data preferences." icon={<FaShieldAlt/>}><Rows><ToggleRow title="Privacy and Policy Updates" text="Receive updates about professional and patient-data responsibilities." checked={privacy} toggle={()=>setPrivacy(!privacy)}/></Rows><div className="portal-settings-note"><FaShieldAlt/><span><strong>Patient information remains protected</strong><small>Clinical data is excluded from personal account exports.</small></span></div><PanelFooter action={()=>setMessage('Privacy preferences saved.')} label="Save Privacy"/></Panel>}
   {active==='sessions'&&<Panel title="Login & Sessions" text="Review and manage your doctor portal sessions." icon={<FaSignOutAlt/>}><Session last="9 August 2026, 7:30 AM" current="Chrome on Windows · Kuala Lumpur" action={()=>setMessage('Other sessions were marked for sign-out. Backend support will be connected later.')}/></Panel>}
  </SettingsShell>
 </DoctorLayout>
}
export default DoctorSettings;
