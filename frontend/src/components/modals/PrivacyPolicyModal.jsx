import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import "../../styles/PrivacyPolicyModal.css";

export default function PrivacyPolicyModal({ clinicInfo, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="privacy-policy-modal" aria-labelledby="privacy-policy-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="privacy-policy-header">
        <div><p>Klinik Pergigian Rosni Adam</p><h2 id="privacy-policy-title">Privacy Policy</h2></div>
        <button type="button" className="privacy-policy-x" onClick={onClose} aria-label="Close Privacy Policy"><FaTimes aria-hidden="true" /></button>
      </header>
      <div className="privacy-policy-content">
        <p>This notice explains how information is handled within our Secure Dental Clinic System. Contact the clinic if you have questions about your information.</p>
        <section><h3>1. Information collected</h3><p>The system records registration and contact details, identity number, date of birth, gender, appointment information, clinical records and images, and billing information. Account and security activity may also be recorded.</p></section>
        <section><h3>2. How patient information is used</h3><p>Information supports account management, appointment scheduling, dental care, clinical record keeping, billing, and service messages such as email verification, password resets and appointment updates.</p></section>
        <section><h3>3. Data security</h3><p>The system uses password hashing, encryption for selected sensitive fields, access controls and security logs to help protect information. These safeguards reduce risk but cannot guarantee complete security.</p></section>
        <section><h3>4. Role-based access to information</h3><p>Patients access their own information. Doctor and administrator access is controlled by role and the permissions needed for clinical care or clinic operations.</p></section>
        <section><h3>5. Data sharing</h3><p>Authorized clinic staff use information for their permitted tasks. Service providers involved in sending system emails process recipient addresses and message content. Contact the clinic for details about any other disclosures or requests for information.</p></section>
        <section><h3>6. User responsibilities</h3><p>Provide accurate information, keep your password and verification or reset links private, and sign out on shared devices. Notify the clinic if your details are incorrect or you suspect unauthorized account access.</p></section>
        <section><h3>7. Contact information</h3><p>For privacy questions or requests to review or correct your information, contact Klinik Pergigian Rosni Adam:</p><address><span>{clinicInfo.address}</span><a href={`tel:${clinicInfo.phone.replace(/\D/g, "")}`}>{clinicInfo.phone}</a><a href={`mailto:${clinicInfo.email}`}>{clinicInfo.email}</a></address></section>
      </div>
      <footer className="privacy-policy-actions"><button type="button" onClick={onClose}>Close</button></footer>
    </dialog>,
    document.body,
  );
}
