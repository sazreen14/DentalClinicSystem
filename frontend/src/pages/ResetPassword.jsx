import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaEye, FaEyeSlash, FaLock, FaShieldAlt } from "react-icons/fa";
import ThemeToggle from "../components/ThemeToggle";
import { resetPassword } from "../services/authApi";
import "../styles/ResetPassword.css";

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

  return <main className="reset-password-page">
    <header className="reset-password-topbar">
      <button type="button" className="reset-password-brand" onClick={() => navigate("/")}>Klinik Pergigian Rosni Adam</button>
      <ThemeToggle />
    </header>
    <section className="reset-password-card">
      {success ? <div className="reset-password-success">
        <FaCheckCircle />
        <span>Account Recovery</span>
        <h1>Password Reset Successful</h1>
        <p>Your password has been updated. You can now log in using your new password.</p>
        <button type="button" onClick={() => navigate("/", { state: { openLogin: true }, replace: true })}>Return to Login</button>
      </div> : <>
        <div className="reset-password-heading">
          <div><FaShieldAlt /></div>
          <span>Secure Account Recovery</span>
          <h1>Create a New Password</h1>
          <p>Choose a strong password for your dental clinic account.</p>
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
          <button className="reset-password-submit" type="submit" disabled={submitting}>{submitting ? "Updating…" : "Reset Password"}</button>
        </form>
      </>}
    </section>
  </main>;
}

export default ResetPassword;
