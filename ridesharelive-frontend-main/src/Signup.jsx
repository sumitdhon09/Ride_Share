import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { apiRequest, storeAuthSession } from "./api";
import { validateEmail, validateFullName, validateOtp, validatePassword } from "./utils/authValidation";

const MotionButton = motion.button;
const MotionDiv = motion.div;
const MotionP = motion.p;

const BUTTON_INTERACTION = {
  whileHover: { y: -2, scale: 1.01 },
  whileTap: { y: 0, scale: 0.98 },
  transition: { type: "spring", stiffness: 420, damping: 28 },
};

const CARD_INTERACTION = {
  whileHover: { y: -4, scale: 1.01 },
  whileTap: { scale: 0.985 },
  transition: { type: "spring", stiffness: 340, damping: 24 },
};

const ALERT_TRANSITION = {
  initial: { opacity: 0, y: 10, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(6px)" },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

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
  const [focusedField, setFocusedField] = useState("");
  const [otpFeedback, setOtpFeedback] = useState({ type: "idle", token: 0 });
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

  const triggerOtpFeedback = (type) => {
    setOtpFeedback((previous) => ({ type, token: previous.token + 1 }));
  };

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setOtpCooldownSeconds((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [otpCooldownSeconds]);

  useEffect(() => {
    if (otpFeedback.type === "idle") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setOtpFeedback((previous) => ({ ...previous, type: "idle" }));
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [otpFeedback]);

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
      triggerOtpFeedback("error");
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
      triggerOtpFeedback("success");
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
      triggerOtpFeedback("error");
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
      triggerOtpFeedback("error");
      return;
    }
    if (nextOtpError) {
      setError(nextOtpError);
      triggerOtpFeedback("error");
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
        triggerOtpFeedback("success");
        onSignup?.(loginPayload);
        return;
      } catch {
        setSuccess(copy.signupSuccess);
        triggerOtpFeedback("success");
      }

      setDevOtpHint("");
      setOtp("");
      setOtpRequested(false);
      onSignup?.();
    } catch (requestError) {
      setError(resolveSignupErrorMessage(requestError, copy));
      triggerOtpFeedback("error");
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
          className={`auth-input ${focusedField === "name" ? "auth-input--focused" : ""}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={() => setFocusedField("name")}
          onBlur={() => {
            setFocusedField("");
            setTouched((previous) => ({ ...previous, name: true }));
          }}
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
          className={`auth-input ${focusedField === "email" ? "auth-input--focused" : ""}`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={() => setFocusedField("email")}
          onBlur={() => {
            setFocusedField("");
            setTouched((previous) => ({ ...previous, email: true }));
          }}
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
          className={`auth-input ${focusedField === "password" ? "auth-input--focused" : ""}`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onFocus={() => setFocusedField("password")}
          onBlur={() => {
            setFocusedField("");
            setTouched((previous) => ({ ...previous, password: true }));
          }}
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

      <MotionDiv
        className="auth-utility-card"
        whileHover={{ y: -1 }}
        animate={
          otpFeedback.type === "success"
            ? { scale: [1, 1.012, 1], y: [0, -2, 0] }
            : { scale: 1, y: 0 }
        }
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <MotionButton
          type="button"
          className="auth-otp-action"
          onClick={handleRequestOtp}
          disabled={otpLoading || otpCooldownSeconds > 0}
          {...BUTTON_INTERACTION}
        >
          {otpLoading
            ? copy.otpLoading
            : otpCooldownSeconds > 0
              ? `Resend in ${otpCooldownSeconds}s`
              : otpRequested
                ? copy.otpResendAction
                : copy.otpAction}
        </MotionButton>
        <span className="auth-otp-helper">{otpHelperMessage}</span>
      </MotionDiv>

      <MotionDiv
        key={`${otpFeedback.type}-${otpFeedback.token}`}
        animate={
          otpFeedback.type === "error"
            ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
            : otpFeedback.type === "success"
              ? { scale: [1, 1.015, 1], y: [0, -1, 0] }
              : { x: 0, scale: 1, y: 0 }
        }
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      >
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
            className={`auth-input ${focusedField === "otp" ? "auth-input--focused" : ""} ${
              otpFeedback.type === "error" ? "auth-input--otp-error" : ""
            } ${otpFeedback.type === "success" ? "auth-input--otp-success" : ""}`}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onFocus={() => setFocusedField("otp")}
            onBlur={() => {
              setFocusedField("");
              setTouched((previous) => ({ ...previous, otp: true }));
            }}
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
      </MotionDiv>

      <AnimatePresence mode="popLayout">
        {error ? (
          <MotionP
            key={`signup-error-${error}`}
            className="auth-message auth-message--error"
            initial={{ opacity: 0, y: 10, filter: "blur(8px)", x: 0 }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {error}
          </MotionP>
        ) : null}
        {success ? (
          <MotionP
            key={`signup-success-${success}`}
            className="auth-message auth-message--success"
            initial={{ opacity: 0, y: 10, filter: "blur(8px)", scale: 0.985 }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: [1, 1.012, 1] }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {success}
          </MotionP>
        ) : null}
        {devOtpHint ? (
          <MotionP
            key={`signup-dev-otp-${devOtpHint}`}
            className="auth-message auth-message--success"
            {...ALERT_TRANSITION}
          >
            {devOtpHint}
          </MotionP>
        ) : null}
      </AnimatePresence>

      <MotionButton type="submit" className="auth-submit" disabled={loading} {...BUTTON_INTERACTION}>
        {loading ? copy.createAccountLoading : copy.createAccountAction}
      </MotionButton>

      <div className="auth-role-grid" aria-label={copy.role}>
        {roleCards.map((item) => (
          <MotionButton
            key={item.value}
            type="button"
            className={`auth-role-card ${role === item.value ? "auth-role-card--active" : ""}`}
            onClick={() => setRole(item.value)}
            {...CARD_INTERACTION}
          >
            <span className="auth-role-card__badge">{item.value === "RIDER" ? "R" : "D"}</span>
            <span className="auth-role-card__copy">
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </MotionButton>
        ))}
      </div>
    </form>
  );
}
