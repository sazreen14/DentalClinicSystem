import { useState } from "react";
import {
  FaEnvelope,
  FaArrowLeft,
  FaShieldAlt,
  FaCheckCircle,
} from "react-icons/fa";

import "../../styles/ForgotPasswordModal.css";
import { requestPasswordReset } from "../../services/authApi";

function ForgotPasswordModal({ onClose, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forgot-modal-overlay" onMouseDown={onClose}>
      <div
        className="forgot-modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="forgot-modal-close"
          onClick={onClose}
          aria-label="Close forgot password modal"
        >
          ×
        </button>

        {!submitted ? (
          <>
            <div className="forgot-modal-heading">
              <div className="forgot-modal-icon">
                <FaShieldAlt />
              </div>

              <span>Account Recovery</span>
              <h2>Forgot Your Password?</h2>

              <p>
                Enter the email address registered with your patient account.
                We will send you instructions to reset your password.
              </p>
            </div>

            <form className="forgot-form" onSubmit={handleSubmit}>
              {error && <div className="forgot-form-message" role="alert">{error}</div>}
              <div className="forgot-field">
                <label htmlFor="forgot-email">Email Address</label>

                <div className="forgot-input-wrapper">
                  <FaEnvelope />

                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="forgot-submit-button" disabled={submitting}>
                {submitting ? "Sending…" : "Send Reset Instructions"}
              </button>
            </form>

            <button
              type="button"
              className="forgot-back-button"
              onClick={onBackToLogin}
            >
              <FaArrowLeft />
              Back to Login
            </button>
          </>
        ) : (
          <div className="forgot-success">
            <div className="forgot-success-icon">
              <FaCheckCircle />
            </div>

            <h2>Check Your Email</h2>

            <p className="forgot-success-note">
              If an account exists for this email, we have sent password reset instructions.
            </p>

            <button
              type="button"
              className="forgot-submit-button"
              onClick={onBackToLogin}
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
