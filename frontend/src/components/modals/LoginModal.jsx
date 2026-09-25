import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
} from "react-icons/fa";

import "../../styles/LoginModal.css";

function LoginModal({
  onClose,
  onSwitchToRegister,
  onForgotPassword,
  notice,
}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState("");
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
    setError("");
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
          aria-label="Close login modal"
        >
          ×
        </button>

        <div className="auth-modal-heading">
          <div className="auth-modal-icon">
            <FaShieldAlt />
          </div>

          <span>Secure Patient Portal</span>

          <h2>Welcome Back</h2>

          <p>
            Log in to manage your appointments and patient information.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {notice && <div className="auth-form-message success" role="status">{notice}</div>}
          {error && <div className="auth-form-message error" role="alert">{error}</div>}
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

          <button type="submit" className="auth-submit-button" disabled={submitting}>
            {submitting ? "Signing in…" : "Login to Portal"}
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
      </div>
    </div>
  );
}

export default LoginModal;
