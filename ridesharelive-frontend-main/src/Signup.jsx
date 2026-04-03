import { useEffect, useState } from "react";
import { apiRequest } from "./api";

function normalizeDefaultRole(role) {
  if (role === "ADMIN" || role === "DRIVER" || role === "RIDER") {
    return role;
  }
  if (role === "USER") {
    return "RIDER";
  }
  return "RIDER";
}

const publicAdminAccessEnabled =
  String(import.meta.env.VITE_ENABLE_PUBLIC_ADMIN_ACCESS || "").toLowerCase() === "true" || import.meta.env.DEV;

function getRoleBadge(role) {
  if (role === "RIDER") {
    return "R";
  }
  if (role === "DRIVER") {
    return "D";
  }
  return "A";
}

function normalizeSignupError(message) {
  const rawMessage = typeof message === "string" ? message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("gmail rejected login") ||
    normalized.includes("authentication failed") ||
    normalized.includes("smtp") ||
    normalized.includes("app password") ||
    normalized.includes("mail_password") ||
    normalized.includes("resend") ||
    normalized.includes("mail server")
  ) {
    return {
      tone: "config",
      text: "OTP email delivery failed. Check the backend email provider configuration and sender setup, then resend OTP.",
    };
  }

  return {
    tone: "error",
    text: rawMessage || "Unable to signup.",
  };
}

export default function Signup({ onSignup, labels = {}, defaultRole = "RIDER" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState(normalizeDefaultRole(defaultRole));
  const [error, setError] = useState("");
  const [errorTone, setErrorTone] = useState("error");
  const [success, setSuccess] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");
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
    rider: "Passenger",
    driver: "Driver",
    admin: "Admin",
    signupSuccess: "Signup successful. Please login.",
    createAccountAction: "Create account",
    createAccountLoading: "Creating...",
    ...labels,
  };
  const roleCards = [
    { value: "RIDER", label: copy.rider },
    { value: "DRIVER", label: copy.driver },
    ...(publicAdminAccessEnabled ? [{ value: "ADMIN", label: copy.admin }] : []),
  ];

  const handleRequestOtp = async () => {
    if (!name.trim() || !email.trim()) {
      setError(copy.otpRequestValidation);
      setErrorTone("error");
      setSuccess("");
      return;
    }

    setError("");
    setErrorTone("error");
    setSuccess("");
    setDevOtpHint("");
    setOtpLoading(true);
    try {
      const payload = await apiRequest("/auth/signup/request-otp", "POST", {
        name: name.trim(),
        email: email.trim(),
      });
      setOtpRequested(true);
      setSuccess(payload?.message || copy.otpSentSuccess);
      setDevOtpHint(payload?.devOtp ? `Development OTP: ${payload.devOtp}` : "");
    } catch (requestError) {
      const nextError = normalizeSignupError(requestError.message || "Unable to send OTP.");
      setError(nextError.text);
      setErrorTone(nextError.tone);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setErrorTone("error");
    setSuccess("");
    if (!otpRequested || !otp.trim()) {
      setError(copy.otpRequired);
      setErrorTone("error");
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
      setDevOtpHint("");
      setOtp("");
      setOtpRequested(false);
      onSignup?.();
    } catch (requestError) {
      const nextError = normalizeSignupError(requestError.message || "Unable to signup.");
      setError(nextError.text);
      setErrorTone(nextError.tone);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(normalizeDefaultRole(defaultRole));
  }, [defaultRole]);

  return (
    <form onSubmit={handleSubmit} className="auth-form auth-form--signup">
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

      <div className="auth-utility-card auth-utility-card--otp">
        <button
          type="button"
          className="auth-otp-action"
          onClick={handleRequestOtp}
          disabled={otpLoading}
        >
          {otpLoading ? copy.otpLoading : otpRequested ? copy.otpResendAction : copy.otpAction}
        </button>
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

      {error && <p className={`auth-message ${errorTone === "config" ? "auth-message--config" : "auth-message--error"}`}>{error}</p>}
      {success && <p className="auth-message auth-message--success">{success}</p>}
      {devOtpHint && <p className="auth-message auth-message--warning">{devOtpHint}</p>}

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? copy.createAccountLoading : copy.createAccountAction}
      </button>

      <div
        className={`auth-role-grid auth-role-grid--signup ${roleCards.length > 2 ? "auth-role-grid--triple" : ""}`}
        aria-label={copy.role}
      >
        {roleCards.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`auth-role-card ${role === item.value ? "auth-role-card--active" : ""}`}
            onClick={() => setRole(item.value)}
          >
            <span className="auth-role-card__badge">{getRoleBadge(item.value)}</span>
            <span className="auth-role-card__copy">
              <strong>{item.label}</strong>
            </span>
          </button>
        ))}
      </div>
    </form>
  );
}
