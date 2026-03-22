import { useEffect, useState } from "react";
import { apiRequest, storeAuthSession } from "./api";
import { validateEmail, validateFullName, validateOtp, validatePassword } from "./utils/authValidation";

function formatOtpExpiryLabel(expiresAt) {
  if (!expiresAt) {
    return "";
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function resolveOtpRequestErrorMessage(error, copy) {
  const rawMessage = String(error?.message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("wait before requesting another otp")) {
    return copy.otpRateLimited;
  }
  if (normalized.includes("email otp is disabled")) {
    return copy.otpDisabledError;
  }
  if (normalized.includes("mail server is not configured")) {
    return copy.otpMailConfigError;
  }
  if (normalized.includes("mail_username is missing") || normalized.includes("mail_password is missing")) {
    return copy.otpCredentialError;
  }
  if (normalized.includes("mail_from_address is missing")) {
    return copy.otpFromAddressError;
  }
  return rawMessage || copy.otpRequestFailure;
}

function resolveSignupErrorMessage(error, copy) {
  const rawMessage = String(error?.message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("request an otp first")) {
    return copy.otpRequired;
  }
  if (normalized.includes("otp expired")) {
    return copy.otpExpiredError;
  }
  if (normalized.includes("invalid otp")) {
    return copy.otpInvalidError;
  }
  return rawMessage || "Unable to signup.";
}

export default function Signup({ onSignup, labels = {}, defaultRole = "RIDER" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const [otpExpiresAtLabel, setOtpExpiresAtLabel] = useState("");
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    otp: false,
  });
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
    otpSentSuccess: "OTP sent. Check your email and enter the code below.",
    otpDemoFallback: "Direct OTP delivery is unavailable on this demo. Use the code shown below.",
    otpRateLimited: "An OTP was just sent. Please wait before requesting another one.",
    otpDisabledError: "OTP sending is disabled on the server right now.",
    otpMailConfigError: "OTP email is not configured on the server yet.",
    otpCredentialError: "Server email credentials are incomplete. OTP cannot be sent right now.",
    otpFromAddressError: "Server sender email is missing. OTP cannot be sent right now.",
    otpRequestFailure: "Unable to send OTP.",
    otpExpiredError: "This OTP expired. Request a new code and try again.",
    otpInvalidError: "The OTP you entered is invalid. Check the code and try again.",
    role: "Role",
    rider: "Rider",
    driver: "Driver",
    signupSuccess: "Signup successful. Please login.",
    signupAutoLoginSuccess: "Account created. You are now signed in.",
    createAccountAction: "Create account",
    createAccountLoading: "Creating...",
    ...labels,
  };
  const roleCards = [
    { value: "RIDER", label: copy.rider, hint: "Request rides quickly" },
    { value: "DRIVER", label: copy.driver, hint: "Accept trips and earn" },
  ];
  const nameError = touched.name ? validateFullName(name) : "";
  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const otpError = touched.otp && otpRequested ? validateOtp(otp) : "";
  const otpHelperMessage = devOtpHint
    ? copy.otpDemoFallback
    : otpRequested
      ? `${copy.otpSentSuccess}${otpCooldownSeconds > 0 ? ` Resend in ${otpCooldownSeconds}s.` : ""}${
          otpExpiresAtLabel ? ` Code expires at ${otpExpiresAtLabel}.` : ""
        }`
      : copy.otpRequired;

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setOtpCooldownSeconds((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [otpCooldownSeconds]);

  const handleRequestOtp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextNameError = validateFullName(trimmedName);
    const nextEmailError = validateEmail(trimmedEmail);

    setTouched((previous) => ({
      ...previous,
      name: true,
      email: true,
    }));

    if (nextNameError || nextEmailError) {
      setError(copy.otpRequestValidation);
      setSuccess("");
      setDevOtpHint("");
      return;
    }

    setError("");
    setSuccess("");
    setDevOtpHint("");
    setOtpLoading(true);
    try {
      const payload = await apiRequest("/auth/signup/request-otp", "POST", {
        name: trimmedName,
        email: trimmedEmail,
      });
      const nextDevOtp = String(payload?.devOtp || "").trim();
      const retryAfterSeconds = Math.max(0, Number(payload?.retryAfterSeconds) || 30);
      setOtpRequested(true);
      setOtpCooldownSeconds(retryAfterSeconds);
      setOtpExpiresAtLabel(formatOtpExpiryLabel(payload?.expiresAt));
      if (nextDevOtp) {
        setOtp(nextDevOtp);
        setDevOtpHint(`Demo OTP: ${nextDevOtp}`);
        setSuccess(copy.otpDemoFallback);
      } else {
        setDevOtpHint("");
        setSuccess(payload?.message || copy.otpSentSuccess);
      }
    } catch (requestError) {
      setDevOtpHint("");
      const retryAfterSeconds = Math.max(0, Number(requestError?.payload?.retryAfterSeconds) || 0);
      if (retryAfterSeconds > 0) {
        setOtpRequested(true);
        setOtpCooldownSeconds(retryAfterSeconds);
      }
      setError(resolveOtpRequestErrorMessage(requestError, copy));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextNameError = validateFullName(name);
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    const nextOtpError = otpRequested ? validateOtp(otp) : "";

    setTouched({
      name: true,
      email: true,
      password: true,
      otp: true,
    });
    setError("");
    setSuccess("");
    if (nextNameError || nextEmailError || nextPasswordError) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }
    if (!otpRequested || !otp.trim()) {
      setError(copy.otpRequired);
      return;
    }
    if (nextOtpError) {
      setError(nextOtpError);
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

      try {
        const loginPayload = await apiRequest("/auth/login", "POST", {
          email: email.trim(),
          password,
          role,
        });
        storeAuthSession(loginPayload);
        setSuccess(copy.signupAutoLoginSuccess);
        setDevOtpHint("");
        setOtp("");
        setOtpRequested(false);
        onSignup?.(loginPayload);
        return;
      } catch {
        setSuccess(copy.signupSuccess);
      }

      setDevOtpHint("");
      setOtp("");
      setOtpRequested(false);
      onSignup?.();
    } catch (requestError) {
      setError(resolveSignupErrorMessage(requestError, copy));
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
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          className="auth-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched((previous) => ({ ...previous, name: true }))}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "signup-name-error" : undefined}
          required
        />
        {nameError && (
          <p id="signup-name-error" className="mt-2 text-xs font-semibold text-rose-600">
            {nameError}
          </p>
        )}
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-email">
          {copy.email}
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched((previous) => ({ ...previous, email: true }))}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "signup-email-error" : undefined}
          required
        />
        {emailError && (
          <p id="signup-email-error" className="mt-2 text-xs font-semibold text-rose-600">
            {emailError}
          </p>
        )}
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-password">
          {copy.password}
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          className="auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setTouched((previous) => ({ ...previous, password: true }))}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? "signup-password-error" : undefined}
          required
        />
        {passwordError && (
          <p id="signup-password-error" className="mt-2 text-xs font-semibold text-rose-600">
            {passwordError}
          </p>
        )}
      </div>

      <div className="auth-utility-card">
        <button
          type="button"
          className="auth-otp-action"
          onClick={handleRequestOtp}
          disabled={otpLoading || otpCooldownSeconds > 0}
        >
          {otpLoading
            ? copy.otpLoading
            : otpCooldownSeconds > 0
              ? `Resend in ${otpCooldownSeconds}s`
              : otpRequested
                ? copy.otpResendAction
                : copy.otpAction}
        </button>
        <span className="auth-otp-helper">{otpHelperMessage}</span>
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="signup-otp">
          {copy.otp}
        </label>
        <input
          id="signup-otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={copy.otpPlaceholder}
          className="auth-input"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onBlur={() => setTouched((previous) => ({ ...previous, otp: true }))}
          aria-invalid={Boolean(otpError)}
          aria-describedby={otpError ? "signup-otp-error" : undefined}
          required
        />
        {otpError && (
          <p id="signup-otp-error" className="mt-2 text-xs font-semibold text-rose-600">
            {otpError}
          </p>
        )}
      </div>

      {error && <p className="auth-message auth-message--error">{error}</p>}
      {success && <p className="auth-message auth-message--success">{success}</p>}
      {devOtpHint && <p className="auth-message auth-message--success">{devOtpHint}</p>}

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
