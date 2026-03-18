import { useEffect, useState } from "react";
import { apiRequest } from "./api";

export default function Signup({ onSignup, labels = {}, defaultRole = "RIDER" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const copy = {
    fullName: "Full name",
    email: "Email",
    password: "Password",
    otp: "OTP",
    otpPlaceholder: "Enter the 6-digit code",
    otpAction: "Send OTP",
    otpResendAction: "Resend OTP",
    otpLoading: "Sending OTP...",
    otpRequired: "Request OTP and enter it to complete signup.",
    otpRequestValidation: "Enter your name and email before requesting OTP.",
    otpSentSuccess: "OTP sent. Check your email and enter the code.",
    role: "Role",
    rider: "Rider",
    driver: "Driver",
    signupSuccess: "Signup successful. Please login.",
    createAccountAction: "Create account",
    createAccountLoading: "Creating...",
    ...labels,
  };
  const roleCards = [
    { value: "RIDER", label: copy.rider, hint: "Request rides quickly" },
    { value: "DRIVER", label: copy.driver, hint: "Accept trips and earn" },
  ];

  const handleRequestOtp = async () => {
    if (!name.trim() || !email.trim()) {
      setError(copy.otpRequestValidation);
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setOtpLoading(true);
    try {
      const payload = await apiRequest("/auth/signup/request-otp", "POST", {
        name: name.trim(),
        email: email.trim(),
      });
      setOtpRequested(true);
      setSuccess(payload?.message || copy.otpSentSuccess);
    } catch (requestError) {
      setError(requestError.message || "Unable to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!otpRequested || !otp.trim()) {
      setError(copy.otpRequired);
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/signup", "POST", {
        name: name.trim(),
        email: email.trim(),
        password,
        otp: otp.trim(),
        role,
      });
      setSuccess(copy.signupSuccess);
      setOtp("");
      setOtpRequested(false);
      onSignup?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to signup.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  }, [defaultRole]);

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-name">
          {copy.fullName}
        </label>
        <input
          id="signup-name"
          type="text"
          placeholder="Your name"
          className="auth-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-email">
          {copy.email}
        </label>
        <input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-password">
          {copy.password}
        </label>
        <input
          id="signup-password"
          type="password"
          placeholder="Create a password"
          className="auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="auth-utility-card">
        <button
          type="button"
          className="auth-otp-action"
          onClick={handleRequestOtp}
          disabled={otpLoading}
        >
          {otpLoading ? copy.otpLoading : otpRequested ? copy.otpResendAction : copy.otpAction}
        </button>
        <span className="auth-otp-helper">
          {otpRequested ? copy.otpSentSuccess : copy.otpRequired}
        </span>
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-otp">
          {copy.otp}
        </label>
        <input
          id="signup-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={copy.otpPlaceholder}
          className="auth-input"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />
      </div>

      {error && <p className="auth-message auth-message--error">{error}</p>}
      {success && <p className="auth-message auth-message--success">{success}</p>}

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? copy.createAccountLoading : copy.createAccountAction}
      </button>

      <div className="auth-role-grid" aria-label={copy.role}>
        {roleCards.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`auth-role-card ${role === item.value ? "auth-role-card--active" : ""}`}
            onClick={() => setRole(item.value)}
          >
            <span className="auth-role-card__badge">{item.value === "RIDER" ? "R" : "D"}</span>
            <span className="auth-role-card__copy">
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </div>
    </form>
  );
}
