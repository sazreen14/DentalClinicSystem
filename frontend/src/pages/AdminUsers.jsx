import { useState } from "react";
import { FaCheck, FaKey, FaPlus, FaSearch, FaTimes, FaUserCheck, FaUserFriends, FaUserShield, FaUsers, FaUserTie } from "react-icons/fa";
import AdminLayout from "../components/admin/AdminLayout";
import { useIdentity } from "../context/useIdentity";
import "../styles/AdminUsers.css";

const filters = [{ id:"all", label:"All Users" },{ id:"patient", label:"Patients" },{ id:"doctor", label:"Doctors" },{ id:"admin", label:"Administrators" },{ id:"inactive", label:"Inactive" }];
function matchesFilter(user, filter) { if (filter === "all") return true; if (filter === "inactive") return user.status === "Inactive"; return user.role.toLowerCase() === filter; }
function initials(name) { return name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase(); }

function AdminUsers() {
  const { users:identityUsers, loading, error, updateUser } = useIdentity();
  const users = identityUsers.map((user)=>({ ...user,id:user.userId,name:user.fullName,initials:initials(user.fullName),status:user.accountStatus,registered:new Date(`${user.registrationDate}T00:00:00`).toLocaleDateString("en-MY",{day:"numeric",month:"long",year:"numeric"}),linkedPatientId:user.patientId }));
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [feedback, setFeedback] = useState("");
  const searchable = (user) => `${user.name} ${user.email} ${user.id} ${user.role}`.toLowerCase().includes(search.trim().toLowerCase());
  const filterCounts = Object.fromEntries(filters.map((filter) => [filter.id, users.filter((user) => matchesFilter(user, filter.id) && searchable(user)).length]));
  const visibleUsers = users.filter((user) => matchesFilter(user, activeFilter) && searchable(user));
  const activeAdminCount = users.filter((user) => user.role === "Admin" && user.status === "Active").length;

  function addUser(values) {
    setFeedback(`${values.role} accounts require complete secure registration or controlled provisioning and cannot be created from this form.`); setModal(null);
  }

  function requestEdit(user, values) {
    if (values.role !== user.role) {
      if (user.roleLocked) { setFeedback("Role cannot be changed because this account has an established patient or professional relationship."); setModal(null); return; }
      if (user.role === "Admin" && user.status === "Active" && activeAdminCount === 1) { setFeedback("The last active Administrator account cannot be reassigned."); setModal(null); return; }
      if (values.status === "Inactive" && user.status === "Active") { setFeedback("Confirm the role change and account deactivation as separate updates."); setModal(null); return; }
      setModal({ type:"role", user, values }); return;
    }
    if (values.status === "Inactive" && user.status === "Active") {
      if (user.role === "Admin" && activeAdminCount === 1) { setFeedback("The last active Administrator account cannot be deactivated."); setModal(null); return; }
      setModal({ type:"edit-deactivate", user, values }); return;
    }
    saveEdit(user, values);
  }

  async function saveEdit(user, values) {
    const updated = { ...user, ...values, initials:initials(values.name), linkedPatientId:values.role === "Patient" ? (user.linkedPatientId || "Not linked yet") : undefined, professionalTitle:values.role === "Doctor" ? (user.professionalTitle || "Dentist") : undefined, licenseNumber:values.role === "Doctor" ? user.licenseNumber : undefined };
    try{await updateUser(user.id, { fullName:updated.name,email:updated.email,role:updated.role });if(updated.status!==user.status)await updateUser(user.id,{accountStatus:updated.status});setFeedback(`${updated.name}'s account was updated.`);setModal(null);}catch(requestError){setFeedback(requestError.message);}
  }

  async function changeStatus(user, status) {
    if (status === "Inactive" && user.role === "Admin" && user.status === "Active" && activeAdminCount === 1) { setFeedback("The last active Administrator account cannot be deactivated."); setModal(null); return; }
    try{await updateUser(user.id, { accountStatus:status });setFeedback(`${user.name}'s account is now ${status.toLowerCase()}. Linked history was preserved.`);setModal(null);}catch(requestError){setFeedback(requestError.message);setModal(null);}
  }

  return <AdminLayout activePage="users" pageTitle="Users" pageSubtitle="Manage system accounts and role access.">
    {loading&&<p role="status">Loading users…</p>}{!loading&&error&&<p role="alert">{error}</p>}
    {feedback && <div className="admin-users-feedback" role="status"><FaCheck />{feedback}<button type="button" onClick={() => setFeedback("")} aria-label="Dismiss"><FaTimes /></button></div>}
    <section className="admin-users-heading"><div><span>User Management</span><h2>Users</h2><p>Manage system accounts and role access.</p></div><button type="button" onClick={() => setModal({ type:"add" })}><FaPlus /> Add User</button></section>
    <section className="admin-users-summary"><article><div className="teal"><FaUsers /></div><p><strong>{users.length}</strong><span>Total Users</span><small>All system accounts</small></p></article><article><div className="blue"><FaUserFriends /></div><p><strong>{users.filter((user) => user.role === "Patient").length}</strong><span>Patients</span><small>Patient accounts</small></p></article><article><div className="green"><FaUserTie /></div><p><strong>{users.filter((user) => user.role === "Doctor").length}</strong><span>Doctors</span><small>Clinical professionals</small></p></article><article><div className="purple"><FaUserShield /></div><p><strong>{users.filter((user) => user.role === "Admin").length}</strong><span>Administrators</span><small>Management access</small></p></article></section>
    <section className="admin-users-toolbar"><div className="admin-users-tabs" role="tablist">{filters.map((filter) => <button type="button" role="tab" aria-selected={activeFilter === filter.id} className={activeFilter === filter.id ? "active" : ""} key={filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}<span>{filterCounts[filter.id]}</span></button>)}</div><label className="admin-users-search"><FaSearch /><span className="admin-users-sr-only">Search users</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, ID or role" /></label></section>
    <section className="admin-users-panel"><header><div><span>{filters.find((filter) => filter.id === activeFilter).label}</span><h3>System Accounts</h3></div><p>{visibleUsers.length} {visibleUsers.length === 1 ? "user" : "users"} displayed</p></header><div className="admin-users-list">{visibleUsers.length ? visibleUsers.map((user) => <UserCard key={user.id} user={user} setModal={setModal} onActivate={() => changeStatus(user,"Active")} />) : <div className="admin-users-empty"><FaUsers /><h3>No users found</h3><p>Try another filter or search term.</p></div>}</div></section>
    {modal?.type === "details" && <DetailsModal user={modal.user} onClose={() => setModal(null)} />}
    {modal?.type === "add" && <AddUserModal onClose={() => setModal(null)} onAdd={addUser} />}
    {modal?.type === "edit" && <EditUserModal user={modal.user} onClose={() => setModal(null)} onSave={requestEdit} />}
    {modal?.type === "role" && <ConfirmModal title="Confirm Role Change" eyebrow="Access permissions will change" icon={<FaUserShield />} onClose={() => setModal(null)} onConfirm={() => saveEdit(modal.user,modal.values)} confirmLabel="Change Role"><strong>Change {modal.user.name} from {modal.user.role} to {modal.values.role}?</strong><span>The account will receive the permissions associated with its new role.</span></ConfirmModal>}
    {modal?.type === "edit-deactivate" && <ConfirmModal title="Deactivate Account" eyebrow="Save profile and disable access" icon={<FaUserCheck />} onClose={() => setModal(null)} onConfirm={() => saveEdit(modal.user,modal.values)} confirmLabel="Save & Deactivate" danger><strong>Save changes and deactivate {modal.user.name}?</strong><span>All linked patient, appointment, and clinical history will remain preserved.</span></ConfirmModal>}
    {modal?.type === "deactivate" && <ConfirmModal title="Deactivate Account" eyebrow="Account data will be preserved" icon={<FaUserCheck />} onClose={() => setModal(null)} onConfirm={() => changeStatus(modal.user,"Inactive")} confirmLabel="Deactivate" danger><strong>Deactivate {modal.user.name}?</strong><span>Access will be disabled without deleting linked patient, appointment, or clinical history.</span></ConfirmModal>}
    {modal?.type === "reset" && <ConfirmModal title="Reset Password" eyebrow="Mock frontend action" icon={<FaKey />} onClose={() => setModal(null)} onConfirm={() => { setFeedback("Password reset request prepared. Email delivery will be connected later."); setModal(null); }} confirmLabel="Prepare Reset"><strong>Prepare a password reset for {modal.user.name}?</strong><span>No password will be displayed or stored by this mock action.</span></ConfirmModal>}
  </AdminLayout>;
}

function UserCard({ user, setModal, onActivate }) { return <article className="admin-user-card"><div className="admin-user-identity"><div>{user.initials}</div><p><span>User</span><strong>{user.name}</strong><small>{user.id}</small></p></div><div className="admin-user-contact"><span>Email Address</span><strong>{user.email}</strong><small>Registered {user.registered}</small></div><div className="admin-user-access"><span>Role & Access</span><strong className={`role ${user.role.toLowerCase()}`}>{user.role}</strong><small>Last login: {user.lastLogin}</small></div><div className="admin-user-actions"><span className={`admin-user-status ${user.status.toLowerCase()}`}>{user.status}</span><div><button type="button" onClick={() => setModal({ type:"details",user })}>View Details</button><button type="button" onClick={() => setModal({ type:"edit",user })}>Edit User</button><button type="button" onClick={() => setModal({ type:"reset",user })}>Reset Password</button>{user.status === "Active" ? <button type="button" className="danger" onClick={() => setModal({ type:"deactivate",user })}>Deactivate</button> : <button type="button" className="activate" onClick={onActivate}>Activate</button>}</div></div></article>; }
function Modal({ title, eyebrow, onClose, children, footer }) { return <div className="admin-user-modal-overlay" onMouseDown={onClose}><section className="admin-user-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><FaUsers /></div><span><small>{eyebrow}</small><h2>{title}</h2></span><button type="button" onClick={onClose} aria-label="Close"><FaTimes /></button></header>{children}{footer && <footer>{footer}</footer>}</section></div>; }
function DetailsModal({ user, onClose }) { const details = [["Full Name",user.name],["User ID",user.id],["Email",user.email],["Role",user.role],["Account Status",user.status],["Registration Date",user.registered],["Last Login",user.lastLogin],...(user.role === "Doctor" ? [["Professional Title",user.professionalTitle],["License / Registration",user.licenseNumber]] : []),...(user.role === "Patient" ? [["Linked Patient ID",user.linkedPatientId]] : [])]; return <Modal title="User Details" eyebrow="Account Information" onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}><div className="admin-user-modal-grid">{details.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || "Not available"}</strong></div>)}</div></Modal>; }
function AddUserModal({ onClose, onAdd }) { const [role,setRole] = useState("Patient"); function submit(event) { event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget)); onAdd(values); } return <Modal title="Add User" eyebrow="Create system account" onClose={onClose}><form className="admin-user-form" onSubmit={submit}><label><span>Full Name *</span><input name="name" required /></label><label><span>Email *</span><input name="email" type="email" required /></label><label><span>Role *</span><select name="role" value={role} onChange={(event) => setRole(event.target.value)}><option>Patient</option><option>Doctor</option><option>Admin</option></select></label><label><span>Status *</span><select name="status" defaultValue="Active"><option>Active</option><option>Inactive</option></select></label>{role === "Doctor" && <><label><span>Professional Title *</span><input name="professionalTitle" required placeholder="e.g. Dental Surgeon" /></label><label><span>License / Registration Number *</span><input name="licenseNumber" required /></label></>}<footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Add User</button></footer></form></Modal>; }
function EditUserModal({ user, onClose, onSave }) { function submit(event) { event.preventDefault(); onSave(user,Object.fromEntries(new FormData(event.currentTarget))); } return <Modal title="Edit User" eyebrow={`${user.name} · ${user.id}`} onClose={onClose}><form className="admin-user-form" onSubmit={submit}><label><span>Full Name *</span><input name="name" defaultValue={user.name} required /></label><label><span>Email *</span><input name="email" type="email" defaultValue={user.email} required /></label><label><span>Role *</span><select name="role" defaultValue={user.role} disabled={user.roleLocked}><option>Patient</option><option>Doctor</option><option>Admin</option></select>{user.roleLocked && <small>Role locked to preserve linked account data.</small>}{user.roleLocked && <input type="hidden" name="role" value={user.role} />}</label><label><span>Account Status *</span><select name="status" defaultValue={user.status}><option>Active</option><option>Inactive</option></select></label><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save Changes</button></footer></form></Modal>; }
function ConfirmModal({ title, eyebrow, icon, onClose, onConfirm, confirmLabel, danger=false, children }) { return <Modal title={title} eyebrow={eyebrow} onClose={onClose} footer={<><button type="button" onClick={onClose}>Cancel</button><button type="button" className={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</button></>}><div className={`admin-user-confirm ${danger ? "danger" : ""}`}><i>{icon}</i><p>{children}</p></div></Modal>; }

export default AdminUsers;
