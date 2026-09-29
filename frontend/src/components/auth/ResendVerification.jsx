import { useState } from "react";
import { FaEnvelope, FaPaperPlane, FaInfoCircle } from "react-icons/fa";
import "../../styles/ResetPassword.css";
import { resendVerification } from "../../services/authApi";

export default function ResendVerification({ initialEmail = "", variant = "default", readOnly = false }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try { setMessage((await resendVerification(email)).message); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <form className={`reset-password-form${variant === "login" ? " auth-resend-form" : ""}`} onSubmit={submit}>
    <label><span>Registered email address</span><div className="reset-password-input">{variant === "login" && <FaEnvelope aria-hidden="true" />}<input type="email" value={email} readOnly={readOnly} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} /></div></label>
    <button className="reset-password-submit" type="submit" disabled={busy}>
      {variant === "login" && <FaPaperPlane aria-hidden="true" />}<span>{busy ? "Requesting..." : "Resend Verification Email"}</span>
    </button>
    {message && <p className={variant === "login" ? "auth-resend-message" : undefined} role="status">{variant === "login" && <FaInfoCircle aria-hidden="true" />}<span>{message}</span></p>}
  </form>;
}
