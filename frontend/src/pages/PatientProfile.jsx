import { useState } from "react";

import {
  FaCamera,
  FaCheckCircle,
  FaEnvelope,
  FaIdCard,
  FaLock,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaSave,
  FaShieldAlt,
  FaUser,
} from "react-icons/fa";

import PatientLayout from "../components/patient/PatientLayout";
import PatientAvatar from "../components/patient/PatientAvatar";
import { useIdentity } from "../context/useIdentity";
import { useAuth } from "../context/useAuth";

import "../styles/PatientProfile.css";

function PatientProfile() {
  const { patients, loading, error, updatePatient, updatePatientPhoto } = useIdentity();
  const { user } = useAuth();
  const currentPatient = user?.patientId ? patients.find((patient) => patient.patientId === user.patientId) : null;

  if (loading) return <PatientLayout activePage="profile" pageTitle="My Profile"><section className="figma-profile-card" role="status"><p>Loading your patient profile…</p></section></PatientLayout>;
  if (!currentPatient) {
    return <PatientLayout activePage="profile" pageTitle="My Profile"><section className="figma-profile-card" role="alert"><h2>Patient profile unavailable</h2><p>{error || "Your authenticated patient profile could not be loaded."}</p></section></PatientLayout>;
  }

  return <PatientProfileForm currentPatient={currentPatient} updatePatient={updatePatient} updatePatientPhoto={updatePatientPhoto} />;
}

function PatientProfileForm({ currentPatient, updatePatient, updatePatientPhoto }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoError, setPhotoError] = useState("");

  const [profileData, setProfileData] = useState({
    fullName: currentPatient.fullName || "",
    email: currentPatient.email || "",
    phone: currentPatient.phone || "",
    address: currentPatient.address || "",
  });
  const identityVersion = `${currentPatient.fullName}|${currentPatient.identityNumber}|${currentPatient.email}|${currentPatient.phone}|${currentPatient.address}`;
  const [loadedIdentityVersion, setLoadedIdentityVersion] = useState(identityVersion);
  if (loadedIdentityVersion !== identityVersion) {
    setLoadedIdentityVersion(identityVersion);
    setProfileData({ fullName:currentPatient.fullName || "", email:currentPatient.email || "", phone:currentPatient.phone || "", address:currentPatient.address || "" });
  }

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfileData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSaved(false);
    setSaveError("");
  }

  async function handleProfileImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoSaving) return;
    setPhotoMessage("");
    setPhotoError("");
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const validTypes = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp" };
    if (validTypes[extension] !== file.type) { setPhotoError("Choose a JPG, PNG, or WEBP image."); return; }
    if (file.size > 2 * 1024 * 1024) { setPhotoError("Profile photo must be 2 MB or smaller."); return; }
    setPhotoSaving(true);
    try {
      await updatePatientPhoto(file);
      setPhotoMessage("Profile photo updated.");
    } catch (requestError) {
      setPhotoError(requestError.message || "Profile photo could not be uploaded.");
    } finally {
      setPhotoSaving(false);
    }
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    if (saving) return;
    const changes = Object.fromEntries(["fullName", "email", "phone", "address"]
      .map((field) => [field, profileData[field].trim()])
      .filter(([field, value]) => value !== (currentPatient[field] || "")));
    if (!Object.keys(changes).length) { setSaved(false); setSaveError(""); return; }

    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const updated = await updatePatient(currentPatient.patientId, changes);
      setProfileData({ fullName:updated.fullName || "", email:updated.email || "", phone:updated.phone || "", address:updated.address || "" });
      setSaved(true);
    } catch (requestError) {
      const detail = requestError.details?.find((item) => item.field);
      const fieldLabels = { fullName:"Full Name", email:"Email Address", phone:"Phone Number", address:"Address" };
      const fieldError = detail && fieldLabels[detail.field]
        ? `${fieldLabels[detail.field]}: ${detail.message === "Invalid value" ? "please check this value." : detail.message}`
        : "";
      setSaveError(fieldError || requestError.message || "Profile changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function handleChangePassword(event) {
    event.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New password and confirmation password do not match.");
      return;
    }

    alert("Password update will be connected to the backend later.");

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }

  return (
    <PatientLayout
      activePage="profile"
      pageTitle="My Profile"
      patientName={profileData.fullName}
      patientId={`Patient ID: ${currentPatient.patientId}`}
      patientInitials={currentPatient.initials}
    >
      <section className="figma-profile-heading">
        <div>
          <span>Account Settings</span>
          <h2>My Profile</h2>
          <p>Manage your personal information, photo, and account security.</p>
        </div>

        <div className="figma-profile-heading-icon" aria-hidden="true">
          <FaUser />
        </div>
      </section>

      <section className="figma-profile-layout">
        <article className="figma-profile-card figma-profile-details-card">
          <div className="figma-profile-card-heading">
            <div>
              <span>Personal Information</span>
              <h3>Profile Details</h3>
            </div>

            {saved && (
              <div className="figma-profile-saved-badge" role="status">
                <FaCheckCircle />
                Changes saved
              </div>
            )}
          </div>

          <form className="figma-profile-form" onSubmit={handleSaveProfile}>
            {saveError && <p className="figma-profile-save-error" role="alert">{saveError}</p>}
            <label className="figma-profile-full-width">
              Full Name
              <div className="figma-profile-input-wrapper">
                <FaUser />
                <input
                  name="fullName"
                  type="text"
                  value={profileData.fullName}
                  onChange={handleProfileChange}
                  disabled={saving}
                  required
                />
              </div>
            </label>

            <label>
              IC Number (read-only)
              <div className="figma-profile-input-wrapper">
                <FaIdCard />
                <input type="text" value={currentPatient.identityNumber} readOnly aria-readonly="true" />
              </div>
            </label>

            <label>
              Phone Number
              <div className="figma-profile-input-wrapper">
                <FaPhoneAlt />
                <input
                  name="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  disabled={saving}
                  required
                />
              </div>
            </label>

            <label className="figma-profile-full-width">
              Email Address
              <div className="figma-profile-input-wrapper">
                <FaEnvelope />
                <input
                  name="email"
                  type="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  disabled={saving}
                  required
                />
              </div>
            </label>

            <label className="figma-profile-full-width">
              Address
              <div className="figma-profile-input-wrapper figma-profile-address-wrapper">
                <FaMapMarkerAlt />
                <textarea
                  name="address"
                  rows="3"
                  value={profileData.address}
                  onChange={handleProfileChange}
                  disabled={saving}
                />
              </div>
            </label>

            <button type="submit" className="figma-profile-primary-button" disabled={saving}>
              <FaSave />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </article>

        <aside className="figma-profile-side">
          <article className="figma-profile-card figma-profile-photo-card">
            <div className="figma-profile-card-heading">
              <div>
                <span>Profile Photo</span>
                <h3>Your Photo</h3>
              </div>
            </div>

            <div className="figma-profile-photo-content">
              <PatientAvatar className="figma-profile-avatar" photoUrl={currentPatient.photoUrl} initials={currentPatient.initials} alt="Patient profile" />

              <div className="figma-profile-photo-info">
                <strong>{profileData.fullName}</strong>
                <span>Registered Patient</span>

                <label htmlFor="profile-upload" className="figma-profile-upload"><FaCamera />{photoSaving ? "Uploading…" : "Change Photo"}</label>
                <input id="profile-upload" className="figma-profile-file-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={photoSaving} onChange={handleProfileImageChange} />
              </div>
            </div>

            <small>JPG, PNG or WEBP. Maximum file size: 2 MB.</small>
            {photoMessage && <small className="figma-profile-photo-message" role="status">{photoMessage}</small>}
            {photoError && <small className="figma-profile-photo-error" role="alert">{photoError}</small>}
          </article>

          <article className="figma-profile-card">
            <div className="figma-profile-card-heading">
              <div>
                <span>Account Security</span>
                <h3>Update Password</h3>
              </div>
              <div className="figma-profile-security-icon" aria-hidden="true">
                <FaShieldAlt />
              </div>
            </div>

            <form
              className="figma-profile-password-form"
              onSubmit={handleChangePassword}
            >
              <label>
                Current Password
                <div className="figma-profile-input-wrapper">
                  <FaLock />
                  <input
                    name="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
              </label>

              <label>
                New Password
                <div className="figma-profile-input-wrapper">
                  <FaLock />
                  <input
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
              </label>

              <label>
                Confirm New Password
                <div className="figma-profile-input-wrapper">
                  <FaLock />
                  <input
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
              </label>

              <button type="submit" className="figma-profile-primary-button">
                <FaLock />
                Update Password
              </button>
            </form>
          </article>
        </aside>
      </section>
    </PatientLayout>
  );
}

export default PatientProfile;
