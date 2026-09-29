import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaEye, FaEyeSlash, FaLock, FaShieldAlt, FaTooth } from "react-icons/fa";
import { resetPassword } from "../services/authApi";
import "../styles/ResetPassword.css";
import "../styles/VerifyEmail.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [values, setValues] = useState({ newPassword: "", confirmPassword: "" });
  const [visible, setVisible] = useState({ newPassword: false, confirmPassword: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const passwordValid = useMemo(() => values.newPassword.length >= 8
    && values.newPassword.length <= 128
    && /[A-Z]/.test(values.newPassword)
    && /[a-z]/.test(values.newPassword)
    && /[0-9]/.test(values.newPassword), [values.newPassword]);

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!token) return setError("This password reset link is invalid.");
    if (!passwordValid) return setError("Use 8–128 characters with uppercase, lowercase, and a number.");
    if (values.newPassword !== values.confirmPassword) return setError("New passwords do not match.");
    setSubmitting(true);
    try {
      await resetPassword({ token, ...values });
      setValues({ newPassword: "", confirmPassword: "" });
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="verification-page reset-recovery-page">
    <header className="verification-header">
      <button type="button" className="verification-brand" onClick={() => navigate("/")} aria-label="Klinik Pergigian Rosni Adam home">
        <span className="verification-brand-mark" aria-hidden="true"><FaTooth /></span>
        <span className="verification-brand-copy"><strong>Klinik Pergigian Rosni Adam</strong><small>Secure Dental Patient Portal</small></span>
      </button>
    </header>
    <div className="verification-content">
    <section className="verification-card" aria-labelledby="reset-password-title">
      {success ? <div className="verification-result" role="status">
        <div className="verification-icon" aria-hidden="true"><FaCheckCircle /></div>
        <span className="verification-eyebrow">Account Recovery</span>
        <h1 id="reset-password-title">Password Reset Successful</h1>
        <p className="verification-description">Your password has been updated. You can now log in using your new password.</p>
        <button type="button" className="verification-login" onClick={() => navigate("/", { state: { openLogin: true }, replace: true })}>Return to Login</button>
      </div> : <>
        <div className="verification-result">
          <div className="verification-icon" aria-hidden="true"><FaShieldAlt /></div>
          <span className="verification-eyebrow">Secure Account Recovery</span>
          <h1 id="reset-password-title">Create a New Password</h1>
          <p className="verification-description">Choose a strong password for your dental clinic account.</p>
        </div>
        <form className="reset-password-form" onSubmit={submit}>
          {error && <div className="reset-password-message" role="alert">{error}</div>}
          {[{ name: "newPassword", label: "New Password" }, { name: "confirmPassword", label: "Confirm New Password" }].map((field) => <label key={field.name}>
            <span>{field.label}</span>
            <div className="reset-password-input">
              <FaLock />
              <input name={field.name} type={visible[field.name] ? "text" : "password"} value={values[field.name]} onChange={update} autoComplete={field.name === "newPassword" ? "new-password" : "new-password"} required />
              <button type="button" onClick={() => setVisible((current) => ({ ...current, [field.name]: !current[field.name] }))} aria-label={visible[field.name] ? `Hide ${field.label}` : `Show ${field.label}`}>
                {visible[field.name] ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>)}
          <p className="reset-password-policy">Use 8–128 characters with at least one uppercase letter, one lowercase letter, and one number.</p>
          <button className="reset-password-submit verification-login" type="submit" disabled={submitting}>{submitting ? "Updating…" : "Reset Password"}</button>
        </form>
      </>}
    </section>
    </div>
  </main>;
}

export default ResetPassword;
