import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaCheck, FaClock, FaExclamationTriangle, FaInfoCircle, FaShieldAlt } from "react-icons/fa";
import ResendVerification from "../components/auth/ResendVerification";
import { verifyEmail } from "../services/authApi";
import "../styles/VerifyEmail.css";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const pending = useRef(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    // Remove the bearer token from history. Reuse the request during Strict Mode effects.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    let active = true;
    pending.current ??= /^[A-Za-z0-9_-]{43}$/.test(token)
      ? verifyEmail(token).then(value => ({ title: "Email verified successfully", message: value.message }))
        .catch(error => ({ title: ({ ALREADY_VERIFIED: "Email already verified", EXPIRED_VERIFICATION_TOKEN: "Verification link expired", INVALID_VERIFICATION_TOKEN: "Invalid verification link", VALIDATION_ERROR: "Invalid verification link" })[error.code] || "Verification could not be completed", message: error.message, retry: error.code !== "ALREADY_VERIFIED" }))
      : Promise.resolve({ title: "Invalid verification link", message: "Open the complete link from your verification email.", retry: true });
    pending.current.then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [token]);
  const state = !result ? "loading"
    : result.title === "Email verified successfully" ? "success"
      : result.title === "Email already verified" ? "info"
        : result.title === "Verification link expired" ? "expired" : "error";
  const StateIcon = { success: FaCheck, info: FaInfoCircle, expired: FaClock, error: FaExclamationTriangle }[state];

  return <main className="verification-page">
    <header className="verification-header">
      <button type="button" className="verification-brand" onClick={() => navigate("/")} aria-label="Klinik Pergigian Rosni Adam home">
        <span className="verification-brand-mark" aria-hidden="true"><img src="/clinic-logo.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit", display: "block" }} /></span>
        <span className="verification-brand-copy"><strong>Klinik Pergigian Rosni Adam</strong><small>Secure Dental Patient Portal</small></span>
      </button>
    </header>
    <div className="verification-content">
      <section className={`verification-card verification-card--${state}`} aria-labelledby="verification-title">
        <div className="verification-result" role="status" aria-live="polite" aria-atomic="true" aria-busy={!result}>
          <div className="verification-icon" aria-hidden="true">
            {state === "loading" ? <span className="verification-spinner" /> : <StateIcon />}
          </div>
          <span className="verification-eyebrow">Email verification</span>
          <h1 id="verification-title">{state === "success" ? <>Email verified <span>successfully</span></> : result?.title || "Verifying your email?"}</h1>
          <p className="verification-description">{state === "success"
            ? "Your email has been verified successfully. You can now log in to access your patient account."
            : result?.message || "Please wait a moment while we confirm your email address."}</p>
        </div>
        <button type="button" className="verification-login" onClick={() => navigate("/", { state: { openLogin: true }, replace: true })}>
          <span>Return to Login</span><FaArrowRight aria-hidden="true" />
        </button>
        {result?.retry && <div className="verification-recovery">
          <ResendVerification />
          <p className="verification-help">Changing your email? Log in with your current email and request another link from <strong>My Profile</strong>.</p>
        </div>}
        <div className="verification-assurance"><FaShieldAlt aria-hidden="true" /><span>Your secure patient portal</span></div>
      </section>
    </div>
  </main>;
}
