import { useState } from "react";
import {
  FaUser,
  FaIdCard,
  FaPhoneAlt,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaCalendarAlt,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/useAuth";

import "../../styles/RegisterModal.css";

function RegisterModal({ onClose, onSwitchToLogin, onRegistered }) {
  const { registerPatient } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    icNumber: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    address: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToPDPA: false,
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "password" || name === "confirmPassword") {
      setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    }
  }

  function validatePasswords() {
    const password = formData.password;
    if (password.length < 8) return { password: "Password must be at least 8 characters." };
    if (!/[A-Z]/.test(password)) return { password: "Password must include at least one uppercase letter." };
    if (!/[a-z]/.test(password)) return { password: "Password must include at least one lowercase letter." };
    if (!/[0-9]/.test(password)) return { password: "Password must include at least one number." };
    if (password !== formData.confirmPassword) return { confirmPassword: "Password and Confirm Password must match." };
    return {};
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const passwordErrors = validatePasswords();
    if (Object.keys(passwordErrors).length) {
      setFieldErrors(passwordErrors);
      setError("");
      return;
    }
    setFieldErrors({});
    setError("");
    setSubmitting(true);
    try {
      await registerPatient({
        fullName: formData.fullName, email: formData.email, password: formData.password,
        identityNumber: formData.icNumber, dateOfBirth: formData.dateOfBirth,
        gender: formData.gender, phone: formData.phone, address: formData.address,
      });
      setFormData((previous) => ({ ...previous, password: "", confirmPassword: "" }));
      onRegistered();
    } catch (requestError) {
      const passwordDetail = requestError.details?.find((detail) => detail.field === "password");
      if (passwordDetail) {
        setFieldErrors({ password: passwordDetail.message });
        setError("");
      } else {
        const usefulDetail = requestError.details?.find((detail) => detail.message && detail.message !== "Invalid value");
        setError(usefulDetail?.message || requestError.message);
      }
    } finally { setSubmitting(false); }
  }

  return (
    <div className="register-modal-overlay" onMouseDown={onClose}>
      <div
        className="register-modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="register-modal-close"
          onClick={onClose}
          aria-label="Close registration modal"
        >
          ×
        </button>

        <div className="register-modal-heading">
          <div className="register-modal-icon">
            <FaShieldAlt />
          </div>

          <span>Secure Patient Registration</span>
          <h2>Create Your Account</h2>
          <p>
            Register to manage appointments and access your patient portal.
          </p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          {error && <div className="register-form-message" role="alert">{error}</div>}
          <div className="register-grid">
            <div className="register-field">
              <label htmlFor="register-full-name">Full Name</label>

              <div className="register-input-wrapper">
                <FaUser />

                <input
                  id="register-full-name"
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-ic">IC Number</label>

              <div className="register-input-wrapper">
                <FaIdCard />

                <input
                  id="register-ic"
                  name="icNumber"
                  type="text"
                  placeholder="Example: 010101-14-1234"
                  value={formData.icNumber}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-phone">Phone Number</label>

              <div className="register-input-wrapper">
                <FaPhoneAlt />

                <input
                  id="register-phone"
                  name="phone"
                  type="tel"
                  placeholder="Example: 0192817109"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-date-of-birth">Date of Birth</label>
              <div className="register-input-wrapper"><FaCalendarAlt /><input id="register-date-of-birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required /></div>
            </div>

            <div className="register-field">
              <label htmlFor="register-gender">Gender</label>
              <div className="register-input-wrapper"><FaUser /><select id="register-gender" name="gender" value={formData.gender} onChange={handleChange} required><option value="">Select gender</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></div>
            </div>

            <div className="register-field">
              <label htmlFor="register-email">Email Address</label>

              <div className="register-input-wrapper">
                <FaEnvelope />

                <input
                  id="register-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-password">Password</label>

              <div className="register-input-wrapper">
                <FaLock />

                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  aria-describedby="register-password-guidance register-password-error"
                  aria-invalid={Boolean(fieldErrors.password)}
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <small id="register-password-guidance" className="register-password-guidance">
                Password must be at least 8 characters and include uppercase, lowercase, and a number.
              </small>
              {fieldErrors.password && <small id="register-password-error" className="register-field-error" role="alert">{fieldErrors.password}</small>}
            </div>

            <div className="register-field">
              <label htmlFor="register-confirm-password">
                Confirm Password
              </label>

              <div className="register-input-wrapper">
                <FaLock />

                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  aria-describedby={fieldErrors.confirmPassword ? "register-confirm-password-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <small id="register-confirm-password-error" className="register-field-error" role="alert">{fieldErrors.confirmPassword}</small>}
            </div>
          </div>

          <div className="register-field register-field-wide">
            <label htmlFor="register-address">Address</label>
            <div className="register-input-wrapper"><FaMapMarkerAlt /><textarea id="register-address" name="address" rows="2" placeholder="Enter your address" value={formData.address} onChange={handleChange} required /></div>
          </div>

          <label className="register-consent">
            <input
              name="agreeToPDPA"
              type="checkbox"
              checked={formData.agreeToPDPA}
              onChange={handleChange}
              required
            />

            <span>
              I agree to the PDPA consent and confirm that the information
              provided is correct.
            </span>
          </label>

          <button type="submit" className="register-submit-button" disabled={submitting}>
            {submitting ? "Creating account…" : "Create Patient Account"}
          </button>
        </form>

        <p className="register-switch-text">
          Already have an account?

          <button type="button" onClick={onSwitchToLogin}>
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegisterModal;
