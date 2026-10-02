import ResendVerification from "../auth/ResendVerification";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  FaEnvelope,
  FaTimes,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaExclamationCircle,
} from "react-icons/fa";

import "../../styles/LoginModal.css";

function LoginModal({
  onClose,
  onSwitchToRegister,
  onForgotPassword,
  notice,
  verificationEmail = "",
}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: verificationEmail,
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(Boolean(verificationEmail));
  const [accountCreated, setAccountCreated] = useState(Boolean(verificationEmail));
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, checked, type } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setVerificationRequired(false);
    setSubmitting(true);
    try {
      const user = await login({ email: formData.email, password: formData.password });
      const dashboard = { Patient: "/patient-dashboard", Doctor: "/doctor-dashboard", Admin: "/admin-dashboard" }[user.role] || "/";
      setFormData((previous) => ({ ...previous, password: "" }));
      onClose();
      navigate(dashboard, { replace: true });
    } catch (requestError) {
      setFormData((previous) => ({ ...previous, password: "" }));
      setError(requestError.message);
      setVerificationRequired(requestError.code === "EMAIL_VERIFICATION_REQUIRED");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="auth-modal-overlay" onMouseDown={onClose}>
      <div
        className="auth-modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close login"
        >
          <FaTimes aria-hidden="true" />
        </button>

        <div className="auth-modal-heading">
          <div className="auth-modal-icon" aria-hidden="true">
            <img src="/clinic-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit", display: "block" }} />
          </div>

          <span>Secure Dental Portal</span>

          <h2 id="login-title">{verificationRequired ? "Email verification required" : "Welcome Back"}</h2>

          <p>
            {verificationRequired
              ? accountCreated
                ? "Your account has been created successfully. Please verify your email address before logging in."
                : "Please verify your email address before logging in to your patient account."
              : "Log in to access your authorized system functions."}
          </p>
        </div>

        {verificationRequired ? (
          <div className="auth-verification" role="group" aria-labelledby="login-title">
            {verificationRequired && error && <div className="auth-form-message error" role="alert"><FaExclamationCircle aria-hidden="true" /><span>{error}</span></div>}
            <ResendVerification initialEmail={formData.email} variant="login" readOnly />
            <p className="auth-switch-text">
              <button type="button" onClick={() => {
                setVerificationRequired(false);
                setAccountCreated(false);
                setError("");
                setShowPassword(false);
              }}>Return to Login</button>
            </p>
          </div>
        ) : <>
        <form className="auth-form" onSubmit={handleSubmit}>
          {notice && <div className="auth-form-message success" role="status">{notice}</div>}
          {error && !verificationRequired && <div className="auth-form-message error" role="alert"><FaExclamationCircle aria-hidden="true" /><span>{error}</span></div>}
          <div className="auth-field">
            <label htmlFor="login-email">Email Address</label>

            <div className="auth-input-wrapper">
              <FaEnvelope />

              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">Password</label>

              <button
                type="button"
                className="forgot-password-button"
                onClick={onForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <div className="auth-input-wrapper">
              <FaLock />

              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <label className="remember-checkbox">
            <input
              name="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleChange}
            />

            <span>Remember me</span>
          </label>

          <button type="submit" className="auth-submit-button" disabled={submitting} aria-busy={submitting}>
            {submitting && <span className="auth-login-spinner" aria-hidden="true" />}
            <span>{submitting ? "Signing in..." : "Login to Portal"}</span>
          </button>
        </form>

        <div className="auth-security-note">
          <FaShieldAlt />

          <span>
            Your login information is protected using secure authentication.
          </span>
        </div>

        <p className="auth-switch-text">
          Don&apos;t have an account?

          <button type="button" onClick={onSwitchToRegister}>
            Register here
          </button>
        </p>
        </>}
      </div>
    </div>
  );
}

export default LoginModal;
