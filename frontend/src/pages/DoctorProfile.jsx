import {useState} from 'react';
import {FaBriefcaseMedical,FaCamera,FaCheckCircle,FaEnvelope,FaIdCard,FaLock,FaSave,FaShieldAlt,FaTooth,FaUser} from 'react-icons/fa';
import DoctorLayout from '../components/doctor/DoctorLayout';
import PatientAvatar from '../components/patient/PatientAvatar';
import {useIdentity} from '../context/useIdentity';
import {changePassword} from '../services/authApi';
import '../styles/DoctorProfile.css';

const fields=['fullName','email','professionalTitle','specialization','licenseNumber','qualification','yearsOfExperience'];
const formValues=doctor=>Object.fromEntries(fields.map(field=>[field,String(doctor[field]??'')]));

function DoctorProfileForm({doctor,updateDoctorProfile,updateDoctorPhoto}){
  const [values,setValues]=useState(()=>formValues(doctor));
  const [loadedVersion,setLoadedVersion]=useState(()=>JSON.stringify(formValues(doctor)));
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[saveError,setSaveError]=useState('');
  const [password,setPassword]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const [passwordSaving,setPasswordSaving]=useState(false),[passwordMessage,setPasswordMessage]=useState(''),[passwordError,setPasswordError]=useState('');
  const [photoSaving,setPhotoSaving]=useState(false),[photoMessage,setPhotoMessage]=useState(''),[photoError,setPhotoError]=useState('');
  const currentVersion=JSON.stringify(formValues(doctor));
  if(currentVersion!==loadedVersion){setLoadedVersion(currentVersion);setValues(formValues(doctor));}
  const initials=doctor.fullName?.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()||'DR';

  function change(event){setValues(previous=>({...previous,[event.target.name]:event.target.value}));setSaved(false);setSaveError('');}
  async function changePhoto(event){
    const file=event.target.files?.[0];event.target.value='';if(!file||photoSaving)return;
    setPhotoMessage('');setPhotoError('');
    const extension=file.name.split('.').at(-1)?.toLowerCase();
    const validTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
    if(validTypes[extension]!==file.type){setPhotoError('Choose a JPG, PNG, or WEBP image.');return;}
    if(file.size>2*1024*1024){setPhotoError('Profile photo must be 2 MB or smaller.');return;}
    setPhotoSaving(true);
    try{await updateDoctorPhoto(file);setPhotoMessage('Profile photo updated.');}
    catch(error){setPhotoError(error.message||'Profile photo could not be uploaded.');}
    finally{setPhotoSaving(false);}
  }
  async function save(event){
    event.preventDefault();if(saving)return;
    if(values.yearsOfExperience.trim()===''&&doctor.yearsOfExperience!=null){setSaveError('Years of Experience cannot be cleared.');return;}
    const changes=Object.fromEntries(fields.filter(field=>values[field].trim()!==String(doctor[field]??'')).map(field=>[field,field==='yearsOfExperience'?Number(values[field]):values[field].trim()]));
    if(!Object.keys(changes).length)return;
    setSaving(true);setSaved(false);setSaveError('');
    try{const updated=await updateDoctorProfile(changes);setValues(formValues(updated));setSaved(true);}
    catch(error){setSaveError(error.message||'Profile changes could not be saved.');}
    finally{setSaving(false);}
  }
  async function updatePassword(event){
    event.preventDefault();if(passwordSaving)return;setPasswordMessage('');setPasswordError('');
    if(password.newPassword!==password.confirmPassword){setPasswordError('New password and confirmation do not match.');return;}
    setPasswordSaving(true);
    try{await changePassword(password);setPassword({currentPassword:'',newPassword:'',confirmPassword:''});setPasswordMessage('Password updated successfully.');}
    catch(error){setPasswordError(error.message||'Password could not be updated.');}
    finally{setPasswordSaving(false);}
  }

  return <DoctorLayout activePage="profile" pageTitle="My Profile" pageSubtitle="Manage your professional information and account security">
    <section className="doctor-profile-heading"><div><span>Professional Account</span><h2>My Profile</h2><p>Manage your professional information and account security.</p></div><div className="doctor-profile-heading-icon" aria-hidden="true"><FaUser/></div></section>
    <section className="doctor-profile-layout">
      <article className="doctor-profile-card doctor-profile-details-card">
        <div className="doctor-profile-card-heading"><div><span>Professional Information</span><h3>Profile Details</h3></div>{saved&&<span className="doctor-profile-saved" role="status"><FaCheckCircle/> Changes saved</span>}</div>
        <form className="doctor-profile-form" onSubmit={save}>
          {saveError&&<p className="doctor-profile-error" role="alert">{saveError}</p>}
          <label className="wide">Full Name<div className="doctor-profile-input"><FaUser/><input name="fullName" value={values.fullName} onChange={change} disabled={saving} required maxLength="150"/></div></label>
          <label>Doctor ID (read-only)<div className="doctor-profile-input"><FaIdCard/><input value={doctor.doctorId||''} readOnly aria-readonly="true"/></div></label>
          <label>Professional Title<div className="doctor-profile-input"><FaBriefcaseMedical/><input name="professionalTitle" value={values.professionalTitle} onChange={change} disabled={saving} required maxLength="100"/></div></label>
          <label className="wide">Specialization<div className="doctor-profile-input"><FaTooth/><input name="specialization" value={values.specialization} onChange={change} disabled={saving} maxLength="150"/></div></label>
          <label className="wide">Email Address<div className="doctor-profile-input"><FaEnvelope/><input name="email" type="email" value={values.email} onChange={change} disabled={saving} required maxLength="254"/></div></label>
          <label>Registration / License Number<div className="doctor-profile-input"><FaIdCard/><input name="licenseNumber" value={values.licenseNumber} onChange={change} disabled={saving} maxLength="80"/></div></label>
          <label>Years of Experience<div className="doctor-profile-input"><input name="yearsOfExperience" type="number" min="0" max="100" value={values.yearsOfExperience} onChange={change} disabled={saving}/></div></label>
          <label className="wide">Qualification<div className="doctor-profile-input"><input name="qualification" value={values.qualification} onChange={change} disabled={saving} maxLength="255"/></div></label>
          <button className="doctor-profile-primary" type="submit" disabled={saving}><FaSave/>{saving?'Saving...':'Save Changes'}</button>
        </form>
      </article>
      <aside className="doctor-profile-side">
        <article className="doctor-profile-card doctor-profile-photo-card"><div className="doctor-profile-card-heading"><div><span>Profile Photo</span><h3>Your Photo</h3></div></div><div className="doctor-profile-photo-content"><PatientAvatar className="doctor-profile-avatar" photoUrl={doctor.photoUrl} initials={initials} alt="Doctor profile"/><div><strong>{doctor.fullName}</strong><span>{doctor.professionalTitle||'Doctor'}</span><label className="doctor-profile-upload" htmlFor="doctor-profile-upload"><FaCamera/>{photoSaving?'Uploading...':'Change Photo'}</label><input id="doctor-profile-upload" className="doctor-profile-file-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={photoSaving} onChange={changePhoto}/></div></div><small>JPG, PNG or WEBP. Maximum file size: 2 MB.</small>{photoMessage&&<small className="doctor-profile-photo-message" role="status">{photoMessage}</small>}{photoError&&<small className="doctor-profile-photo-error" role="alert">{photoError}</small>}</article>
        <article className="doctor-profile-card"><div className="doctor-profile-card-heading"><div><span>Account Security</span><h3>Update Password</h3></div><div className="doctor-profile-security-icon" aria-hidden="true"><FaShieldAlt/></div></div><form className="doctor-profile-password-form" onSubmit={updatePassword}>{passwordError&&<p className="doctor-profile-error" role="alert">{passwordError}</p>}{passwordMessage&&<p className="doctor-profile-password-success" role="status">{passwordMessage}</p>}{[['currentPassword','Current Password'],['newPassword','New Password'],['confirmPassword','Confirm New Password']].map(([name,label])=><label key={name}>{label}<div className="doctor-profile-input"><FaLock/><input type="password" name={name} value={password[name]} onChange={event=>setPassword(previous=>({...previous,[name]:event.target.value}))} disabled={passwordSaving} required/></div></label>)}<button className="doctor-profile-primary" type="submit" disabled={passwordSaving}><FaLock/>{passwordSaving?'Updating...':'Update Password'}</button></form></article>
      </aside>
    </section>
  </DoctorLayout>;
}

export default function DoctorProfile(){
  const {doctorProfile,loading,error,updateDoctorProfile,updateDoctorPhoto}=useIdentity();
  if(loading)return <DoctorLayout activePage="profile" pageTitle="My Profile"><section className="doctor-profile-card" role="status">Loading doctor profile...</section></DoctorLayout>;
  if(!doctorProfile)return <DoctorLayout activePage="profile" pageTitle="My Profile"><section className="doctor-profile-card" role="alert">{error||'Doctor profile is unavailable.'}</section></DoctorLayout>;
  return <DoctorProfileForm doctor={doctorProfile} updateDoctorProfile={updateDoctorProfile} updateDoctorPhoto={updateDoctorPhoto}/>;
}
