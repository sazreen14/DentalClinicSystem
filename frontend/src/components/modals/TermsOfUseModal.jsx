import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import "../../styles/PrivacyPolicyModal.css";

export default function TermsOfUseModal({ clinicInfo, onClose }) {
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
    <dialog ref={dialogRef} className="privacy-policy-modal" aria-labelledby="terms-of-use-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="privacy-policy-header">
        <div><p>Klinik Pergigian Rosni Adam</p><h2 id="terms-of-use-title">Terms of Use</h2></div>
        <button type="button" className="privacy-policy-x" onClick={onClose} aria-label="Close Terms of Use"><FaTimes aria-hidden="true" /></button>
      </header>
      <div className="privacy-policy-content">
        <p>These guidelines explain the intended use of Klinik Pergigian Rosni Adam's Secure Dental Clinic System. Contact the clinic if you need help using the service.</p>
        <section><h3>1. Use of the system</h3><p>Use the system to manage your clinic account, appointments and the information available to your role. The portal supports clinic services and does not replace consultation with a dental professional.</p></section>
        <section><h3>2. User account responsibilities</h3><p>Use your own account, keep your password and verification or reset links private, and sign out on shared devices. Contact the clinic if you suspect unauthorized access.</p></section>
        <section><h3>3. Appointment booking and cancellation</h3><p>A booking request is subject to clinic confirmation and availability. Check your appointment status in the portal. Use the available cancellation or rescheduling options promptly, or contact the clinic if you need assistance.</p></section>
        <section><h3>4. Accuracy of information provided by users</h3><p>Provide accurate and up-to-date registration, contact and health information. Update details where the system allows, and notify the clinic about errors or information you cannot change yourself.</p></section>
        <section><h3>5. Appropriate use of the system</h3><p>Use only the information and functions you are authorized to access. Do not impersonate others, attempt to bypass security controls, submit harmful content or disrupt the service.</p></section>
        <section><h3>6. System availability</h3><p>Access may be interrupted by maintenance, network problems or technical issues. Continuous availability is not guaranteed. Contact the clinic directly if an interruption prevents you from managing an appointment.</p></section>
        <section><h3>7. Contact information</h3><p>For questions about these terms or help using the system, contact Klinik Pergigian Rosni Adam:</p><address><span>{clinicInfo.address}</span><a href={`tel:${clinicInfo.phone.replace(/\D/g, "")}`}>{clinicInfo.phone}</a><a href={`mailto:${clinicInfo.email}`}>{clinicInfo.email}</a></address></section>
      </div>
      <footer className="privacy-policy-actions"><button type="button" onClick={onClose}>Close</button></footer>
    </dialog>,
    document.body,
  );
}
