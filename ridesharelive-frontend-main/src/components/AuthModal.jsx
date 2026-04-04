import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import rideShareLogo from "../../public/ride-share-logo.png";

const publicAdminAccessEnabled =
  String(import.meta.env.VITE_ENABLE_PUBLIC_ADMIN_ACCESS || "").toLowerCase() === "true" || import.meta.env.DEV;

const ROLE_OPTIONS = [
  { value: "RIDER", label: "Passenger", icon: "P" },
  { value: "DRIVER", label: "Driver", icon: "D" },
  ...(publicAdminAccessEnabled ? [{ value: "ADMIN", label: "Admin", icon: "A" }] : []),
];

const MODES = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in with your role, email, and password.",
    ctaPrompt: "New here?",
    ctaAction: "Create account",
  },
  signup: {
    title: "Create your account",
    subtitle: "Set up your profile, verify OTP, and start riding in seconds.",
    ctaPrompt: "Already have an account?",
    ctaAction: "Login",
  },
};

function normalizeDefaultRole(role) {
  if (role === "ADMIN" || role === "DRIVER" || role === "RIDER") return role;
  if (role === "USER") return "RIDER";
  return "RIDER";
}

function normalizeMode(mode) {
  return mode === "signup" ? "signup" : "login";
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
      tone: "warning",
      text: "OTP delivery failed. Verify the configured sender and email provider, then try again.",
    };
  }

  return { tone: "error", text: rawMessage || "Unable to continue." };
}

function resolveRoleLabel(role, labels) {
  if (role === "DRIVER") return labels.driver || "Driver";
  if (role === "ADMIN") return labels.admin || "Admin";
  return labels.rider || labels.user || "Passenger";
}

function resolveRoleOptions(labels) {
  return ROLE_OPTIONS.map((option) => ({ ...option, label: resolveRoleLabel(option.value, labels) }));
}

function ToneMessage({ children, tone = "error" }) {
  const tones = {
    error: "border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,236,230,0.92),rgba(255,228,236,0.94))] text-rose-800",
    warning: "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,248,235,0.94),rgba(255,236,230,0.92))] text-amber-800",
    success: "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,244,0.94),rgba(255,244,239,0.9))] text-emerald-800",
  };

  return <p className={`rounded-2xl border px-3 py-2 text-sm font-medium ${tones[tone] || tones.error}`}>{children}</p>;
}

function OtpCodeInput({ value, onChange, disabled = false, autoFocus = false }) {
  const inputRef = useRef(null);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  return (
    <button
      type="button"
      className="w-full rounded-[24px] border border-white/70 bg-white/60 p-3 text-left shadow-[0_20px_45px_-34px_rgba(251,113,133,0.18)] backdrop-blur-xl transition hover:border-rose-200/90 hover:bg-white/80"
      onClick={() => inputRef.current?.focus()}
      disabled={disabled}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        autoComplete="one-time-code"
        inputMode="numeric"
        className="sr-only"
        autoFocus={autoFocus}
        disabled={disabled}
      />
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <div
            key={index}
            className={`flex aspect-square items-center justify-center rounded-2xl border text-lg font-semibold transition ${digit.trim() ? "border-rose-200/80 bg-[linear-gradient(135deg,#fff1ee,#fecfef)] text-rose-950 shadow-[0_12px_26px_-20px_rgba(251,113,133,0.25)]" : "border-slate-200/80 bg-white/85 text-slate-400"}`}
          >
            {digit.trim() || ""}
          </div>
        ))}
      </div>
    </button>
  );
}

function GlowButton({ children, disabled = false, onClick, type = "button", darkMode = false }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group relative inline-flex min-h-[3.5rem] w-full items-center justify-center overflow-hidden rounded-[22px] px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:scale-[1.01] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${
        darkMode
          ? "bg-[linear-gradient(135deg,#67e8f9_0%,#38bdf8_50%,#c4b5fd_100%)] text-slate-950 shadow-[0_24px_60px_-32px_rgba(56,189,248,0.34)] hover:shadow-[0_28px_70px_-34px_rgba(96,165,250,0.42)]"
          : "bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_46%,#e0e7ff_100%)] text-slate-950 shadow-[0_24px_60px_-32px_rgba(59,130,246,0.26)] hover:shadow-[0_28px_70px_-34px_rgba(96,165,250,0.34)]"
      }`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_50%)] opacity-70" />
      <span className="absolute inset-y-0 left-[-35%] w-1/2 skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)] transition duration-700 group-hover:left-[120%]" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
function RolePills({ value, onChange, labels, darkMode = false }) {
  const roles = useMemo(() => resolveRoleOptions(labels), [labels]);

  return (
    <div className={`grid grid-cols-3 gap-2 rounded-[24px] border p-1 backdrop-blur-xl sm:grid-cols-3 ${darkMode ? "border-white/12 bg-white/[0.07]" : "border-slate-200/80 bg-white/88"}`}>
      {roles.map((role) => (
        <button
          key={role.value}
          type="button"
          onClick={() => onChange(role.value)}
          className={`relative flex min-h-[3.2rem] items-center justify-center gap-2 rounded-[18px] px-3 py-2 text-sm font-semibold transition ${value === role.value ? darkMode ? "bg-[linear-gradient(135deg,rgba(103,232,249,0.18),rgba(59,130,246,0.22),rgba(15,23,42,0.88))] text-white shadow-[0_16px_36px_-24px_rgba(56,189,248,0.38)]" : "bg-[linear-gradient(135deg,#eff6ff,#dbeafe,#eef2ff)] text-sky-950 shadow-[0_16px_36px_-24px_rgba(96,165,250,0.2)]" : darkMode ? "text-slate-100 hover:bg-white/[0.1] hover:text-white" : "text-slate-700 hover:bg-sky-50 hover:text-sky-950"}`}
        >
          {value === role.value ? <span className={`absolute inset-0 rounded-[18px] ${darkMode ? "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),rgba(103,232,249,0.12),transparent_70%)]" : "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.58),rgba(255,154,158,0.22),transparent_70%)]"}`} /> : null}
          <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-white/10 text-xs">{role.icon}</span>
          <span className="relative z-10">{role.label}</span>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, helper, labelClassName = "", helperClassName = "" }) {
  return (
    <label className="block space-y-2">
      <span className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${labelClassName}`}>{label}</span>
      {children}
      {helper ? <span className={`block text-xs ${helperClassName}`}>{helper}</span> : null}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-[20px] border border-white/65 bg-white/62 px-4 py-3.5 text-[15px] text-slate-900 shadow-[0_16px_40px_-30px_rgba(251,113,133,0.14)] outline-none backdrop-blur-xl transition placeholder:text-slate-400 hover:border-rose-200/90 focus:border-rose-300 focus:bg-white/82 focus:shadow-[0_24px_50px_-34px_rgba(251,113,133,0.2)] ${props.className || ""}`}
    />
  );
}

async function requestLiveLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, message: "Location permission is not available on this device." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const payload = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        localStorage.setItem("liveLocation", JSON.stringify(payload));
        resolve({ ok: true, payload });
      },
      () => resolve({ ok: false, message: "Location access denied. You can enable it later from the dashboard." }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function AuthModal({ isOpen, mode = "login", onModeChange, onClose, onLogin, onSignup, labels = {}, productName = "RideShare", defaultRole = "RIDER", theme = "urban-transport" }) {
  const [currentMode, setCurrentMode] = useState(normalizeMode(mode));
  const [signupStep, setSignupStep] = useState(1);
  const [loginForm, setLoginForm] = useState({ email: "", password: "", role: normalizeDefaultRole(defaultRole) });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", role: normalizeDefaultRole(defaultRole), otp: "", allowLocation: true });
  const [error, setError] = useState("");
  const [errorTone, setErrorTone] = useState("error");
  const [success, setSuccess] = useState("");
  const [devOtpHint, setDevOtpHint] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const darkMode = theme === "dark-theme";

  useEffect(() => { setCurrentMode(normalizeMode(mode)); }, [mode]);
  useEffect(() => {
    setLoginForm((previous) => ({ ...previous, role: normalizeDefaultRole(defaultRole) }));
    setSignupForm((previous) => ({ ...previous, role: normalizeDefaultRole(defaultRole) }));
  }, [defaultRole]);
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setError("");
    setSuccess("");
    setDevOtpHint("");
    setBusy(false);
    if (currentMode !== "login") {
      setSignupStep(1);
      setSignupForm((previous) => ({ ...previous, otp: "" }));
    }
  }, [currentMode]);
  const copy = {
    loginTab: labels.loginTab || "Login",
    signupTab: labels.signupTab || "Sign Up",
    rider: labels.rider || labels.user || "Passenger",
    driver: labels.driver || "Driver",
    admin: labels.admin || "Admin",
    email: labels.email || "Email",
    password: labels.password || "Password",
    fullName: labels.fullName || "Full name",
    forgotPassword: labels.forgotPassword || "Forgot password?",
    locationPermission: labels.locationPermission || "Enable live location for better pickup accuracy",
    createAccountAction: labels.createAccountAction || "Create account",
    createAccountLoading: labels.createAccountLoading || "Creating account...",
    loginAction: labels.loginAction || "Login",
    loginLoading: labels.loginLoading || "Signing in...",
  };

  const content = MODES[currentMode];
  const surfaceClass = darkMode
    ? "border-sky-200/10 bg-[linear-gradient(145deg,rgba(6,14,28,0.96),rgba(10,18,34,0.94),rgba(14,23,42,0.9))] text-slate-100 shadow-[0_40px_120px_-50px_rgba(2,6,23,0.95)]"
    : "border-sky-100/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(243,248,255,0.94),rgba(233,242,255,0.92))] text-slate-900 shadow-[0_40px_120px_-50px_rgba(59,130,246,0.18)]";
  const panelClass = darkMode ? "border-sky-200/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(56,189,248,0.08),rgba(15,23,42,0.42))]" : "border-sky-100/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(244,248,255,0.86),rgba(235,243,255,0.82))]";
  const textSubtleClass = darkMode ? "text-slate-200" : "text-slate-700";
  const inputClass = darkMode ? "border-sky-200/10 bg-[linear-gradient(180deg,rgba(14,23,42,0.94),rgba(8,15,28,0.98))] text-white placeholder:text-slate-400 hover:border-sky-300/40 focus:border-sky-300 focus:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(10,18,34,1))]" : "border-sky-100/90 bg-white/92 text-slate-950 placeholder:text-slate-500 hover:border-sky-300/70 focus:border-sky-400";
  const otpContainerClass = darkMode ? "border-sky-200/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(56,189,248,0.05),rgba(15,23,42,0.4))] hover:border-sky-300/24 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(56,189,248,0.08),rgba(15,23,42,0.5))]" : "border-sky-100/80 bg-white/76 hover:border-sky-300/60 hover:bg-white/92";
  const fieldLabelClass = darkMode ? "text-slate-200" : "text-slate-700";
  const helperTextClass = darkMode ? "text-slate-300" : "text-slate-600";
  const overlayClass = darkMode
    ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.34),rgba(2,6,23,0.58))]"
    : "bg-[linear-gradient(180deg,rgba(226,232,240,0.34),rgba(203,213,225,0.56))]";
  const ambientOrbOneClass = darkMode ? "bg-sky-400/16" : "bg-sky-300/20";
  const ambientOrbTwoClass = darkMode ? "bg-cyan-300/14" : "bg-indigo-200/18";
  const ambientOrbThreeClass = darkMode ? "bg-indigo-300/14" : "bg-cyan-100/18";
  const closeButtonClass = darkMode
    ? "border-sky-200/10 bg-slate-900/72 text-slate-100 hover:bg-slate-800/84"
    : "border-sky-100/80 bg-white/82 text-slate-700 hover:bg-white";
  const sidePanelBorderClass = darkMode ? "border-sky-200/10" : "border-sky-100/70";
  const sidePanelBackdropClass = darkMode
    ? "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_60%_70%,rgba(96,165,250,0.12),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.14),transparent)]"
    : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(125,211,252,0.26),transparent_28%),radial-gradient(circle_at_60%_70%,rgba(196,181,253,0.18),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent)]";
  const brandChipClass = darkMode
    ? "border-sky-200/10 bg-slate-900/48 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.28)]"
    : "border-sky-100/80 bg-white/74 shadow-[0_14px_40px_-28px_rgba(59,130,246,0.16)]";
  const brandCaptionClass = darkMode ? "text-slate-200" : "text-slate-500";
  const sideTitleClass = darkMode ? "text-white" : "text-slate-950";
  const sideBodyClass = darkMode ? "text-slate-200" : "text-slate-600";
  const sideFeatureCardClass = darkMode
    ? "rounded-[28px] border border-sky-200/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(56,189,248,0.06),rgba(15,23,42,0.3))] p-5 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.75)] backdrop-blur-xl"
    : "rounded-[28px] border border-sky-100/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.84),rgba(240,246,255,0.88),rgba(232,242,255,0.84))] p-5 shadow-[0_30px_80px_-48px_rgba(59,130,246,0.18)] backdrop-blur-xl";
  const sideFeatureTextClass = darkMode ? "text-slate-100" : "text-slate-700";
  const tabsShellClass = darkMode ? "border-sky-200/10 bg-slate-900/44" : "border-sky-100/80 bg-white/90";
  const tabsIndicatorClass = darkMode
    ? "bg-[linear-gradient(135deg,rgba(103,232,249,0.18),rgba(59,130,246,0.22),rgba(15,23,42,0.22))] shadow-[0_12px_32px_-18px_rgba(56,189,248,0.32)]"
    : "bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(219,234,254,0.98),rgba(255,255,255,0.98))] shadow-[0_12px_32px_-18px_rgba(96,165,250,0.16)]";
  const stepChipClass = darkMode ? "bg-slate-900/48 text-slate-200" : "bg-sky-100/60 text-slate-700";

  const setMode = (nextMode) => {
    const normalized = normalizeMode(nextMode);
    setCurrentMode(normalized);
    onModeChange?.(normalized);
  };

  const showToast = (message, tone = "success") => setToast({ id: `${Date.now()}`, message, tone });

  const handleLoginSubmit = async () => {
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      setError("Enter your email and password to continue.");
      setErrorTone("error");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    setDevOtpHint("");

    try {
      const payload = await apiRequest("/auth/login", "POST", {
        email: loginForm.email.trim(),
        password: loginForm.password,
        role: loginForm.role,
      });
      const serverRole = String(payload.role || "").toUpperCase();
      const effectiveRole = loginForm.role === "ADMIN" || loginForm.role === "DRIVER" ? loginForm.role : serverRole === "USER" ? "RIDER" : serverRole || loginForm.role;
      const accessToken = payload.accessToken || payload.token || "";
      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", payload.refreshToken || "");
      localStorage.setItem("role", effectiveRole);
      localStorage.setItem("name", payload.name || "");
      localStorage.setItem("userId", String(payload.id || ""));
      localStorage.setItem("email", payload.email || loginForm.email.trim());
      onLogin?.({ ...payload, role: effectiveRole });
    } catch (requestError) {
      setError(requestError.message || "Unable to login.");
      setErrorTone("error");
    } finally {
      setBusy(false);
    }
  };

  const handleSignupContinue = async () => {
    if (!signupForm.name.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
      setError("Complete your name, email, and password to request OTP.");
      setErrorTone("error");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    setDevOtpHint("");

    try {
      const payload = await apiRequest("/auth/signup/request-otp", "POST", { name: signupForm.name.trim(), email: signupForm.email.trim() });
      setSignupStep(2);
      setSuccess(payload?.message || "OTP sent successfully.");
      setDevOtpHint(payload?.devOtp ? `Development OTP: ${payload.devOtp}` : "");
      showToast("OTP sent. Verify it to create your account.", "success");
    } catch (requestError) {
      const nextError = normalizeSignupError(requestError.message || "Unable to send OTP.");
      setError(nextError.text);
      setErrorTone(nextError.tone);
    } finally {
      setBusy(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (signupForm.otp.trim().length !== 6) {
      setError("Enter the 6-digit OTP to create your account.");
      setErrorTone("error");
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (signupForm.allowLocation) {
        const locationResult = await requestLiveLocation();
        if (!locationResult.ok && locationResult.message) setSuccess(locationResult.message);
      }

      await apiRequest("/auth/signup", "POST", {
        name: signupForm.name.trim(),
        email: signupForm.email.trim(),
        password: signupForm.password,
        otp: signupForm.otp.trim(),
        role: signupForm.role,
      });

      showToast("Account created successfully.", "success");
      onSignup?.();
    } catch (requestError) {
      const nextError = normalizeSignupError(requestError.message || "Unable to signup.");
      setError(nextError.text);
      setErrorTone(nextError.tone);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = () => {
    setError("");
    setErrorTone("error");
    setSuccess("OTP is needed only in forgot password or signup verification.");
    showToast("Forgot password flow will use OTP.", "success");
  };
  const renderLoginStep = () => (
    <motion.div key="login-step-1" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">
      <Field label="Email / phone" labelClassName={fieldLabelClass} helperClassName={helperTextClass}>
        <Input type="text" placeholder="you@example.com" value={loginForm.email} onChange={(event) => setLoginForm((previous) => ({ ...previous, email: event.target.value }))} className={inputClass} />
      </Field>
      <Field label={copy.password} labelClassName={fieldLabelClass} helperClassName={helperTextClass}>
        <Input type="password" placeholder="Enter your password" value={loginForm.password} onChange={(event) => setLoginForm((previous) => ({ ...previous, password: event.target.value }))} className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <button type="button" onClick={handleForgotPassword} className={`text-sm font-semibold transition ${darkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}>
          {copy.forgotPassword}
        </button>
      </div>
      <div className="space-y-2">
        <span className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${fieldLabelClass}`}>Role</span>
        <RolePills value={loginForm.role} onChange={(role) => setLoginForm((previous) => ({ ...previous, role }))} labels={copy} darkMode={darkMode} />
      </div>
    </motion.div>
  );

  const renderSignupStep = () => signupStep === 1 ? (
    <motion.div key="signup-step-1" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">
      <Field label={copy.fullName} labelClassName={fieldLabelClass} helperClassName={helperTextClass}><Input type="text" placeholder="Your full name" value={signupForm.name} onChange={(event) => setSignupForm((previous) => ({ ...previous, name: event.target.value }))} className={inputClass} /></Field>
      <Field label={copy.email} labelClassName={fieldLabelClass} helperClassName={helperTextClass}><Input type="email" placeholder="you@example.com" value={signupForm.email} onChange={(event) => setSignupForm((previous) => ({ ...previous, email: event.target.value }))} className={inputClass} /></Field>
      <Field label={copy.password} labelClassName={fieldLabelClass} helperClassName={helperTextClass}><Input type="password" placeholder="Create a secure password" value={signupForm.password} onChange={(event) => setSignupForm((previous) => ({ ...previous, password: event.target.value }))} className={inputClass} /></Field>
      <div className="space-y-2">
        <span className={`text-[0.72rem] font-semibold uppercase tracking-[0.22em] ${fieldLabelClass}`}>Role</span>
        <RolePills value={signupForm.role} onChange={(role) => setSignupForm((previous) => ({ ...previous, role }))} labels={copy} darkMode={darkMode} />
      </div>
    </motion.div>
  ) : (
    <motion.div key="signup-step-2" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="space-y-4">
      <Field label="OTP" labelClassName={fieldLabelClass} helperClassName={helperTextClass}><div className={otpContainerClass}><OtpCodeInput value={signupForm.otp} onChange={(otp) => setSignupForm((previous) => ({ ...previous, otp }))} autoFocus disabled={busy} /></div></Field>
      <label className={`flex items-center justify-between gap-4 rounded-[24px] border p-4 ${panelClass}`}>
        <div className="space-y-1"><p className="text-sm font-semibold text-inherit">Location permission</p><p className={`text-sm ${textSubtleClass}`}>{copy.locationPermission}</p></div>
        <span className={`relative inline-flex h-7 w-12 rounded-full p-1 transition ${signupForm.allowLocation ? darkMode ? "bg-[linear-gradient(135deg,#ff9a9e,#fecfef)]" : "bg-[linear-gradient(135deg,#ff9a9e,#fecfef)]" : "bg-slate-300/80"}`}><input type="checkbox" className="sr-only" checked={signupForm.allowLocation} onChange={(event) => setSignupForm((previous) => ({ ...previous, allowLocation: event.target.checked }))} /><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${signupForm.allowLocation ? "translate-x-5" : "translate-x-0"}`} /></span>
      </label>
    </motion.div>
  );

  if (!isOpen) return null;

  const activeStep = currentMode === "login" ? 1 : signupStep;
  const stepCount = currentMode === "login" ? 1 : 2;
  const isFinalStep = currentMode === "signup" && activeStep === 2;
  const primaryLabel = currentMode === "login" ? busy ? copy.loginLoading : copy.loginAction : isFinalStep ? busy ? copy.createAccountLoading : "Create account" : busy ? "Sending OTP..." : "Continue";
  const secondaryAction = currentMode === "login" ? () => setMode("signup") : () => (isFinalStep ? setSignupStep(1) : setMode("login"));
  const secondaryLabel = currentMode === "login" ? content.ctaAction : isFinalStep ? "Back" : content.ctaAction;
  const handlePrimaryAction = () => { if (currentMode === "login") { handleLoginSubmit(); return; } if (signupStep === 1) { handleSignupContinue(); return; } handleSignupSubmit(); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`fixed inset-0 z-50 flex flex-col overflow-y-auto px-3 py-3 backdrop-blur-xl sm:grid sm:min-h-0 sm:place-items-center sm:overflow-hidden sm:px-6 sm:py-6 ${overlayClass}`}
        onClick={() => onClose?.()}
        role="presentation"
      >
        {/* Mobile: tappable dimmed area above bottom sheet so backdrop clicks always dismiss */}
        <div className="min-h-[min(120px,25vh)] flex-1 w-full sm:hidden" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={`absolute left-[-8%] top-[-10%] h-56 w-56 rounded-full blur-3xl ${ambientOrbOneClass}`} />
          <div className={`absolute right-[-8%] top-[8%] h-64 w-64 rounded-full blur-3xl ${ambientOrbTwoClass}`} />
          <div className={`absolute bottom-[-10%] left-[30%] h-56 w-56 rounded-full blur-3xl ${ambientOrbThreeClass}`} />
        </div>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2"
            >
              <ToneMessage tone={toast.tone}>{toast.message}</ToneMessage>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(12px)" }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className={`relative z-10 mx-auto mt-auto flex w-full max-w-[860px] shrink-0 flex-col overflow-hidden rounded-t-[32px] border backdrop-blur-2xl sm:mt-0 sm:max-h-[85vh] sm:rounded-[32px] md:grid md:grid-cols-[0.98fr_1.02fr] ${surfaceClass}`}
        >
          <button
            type="button"
            aria-label="Close authentication panel"
            onClick={() => onClose?.()}
            className={`absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border text-lg transition ${closeButtonClass}`}
          >
            x
          </button>

          <div className={`relative overflow-hidden border-b px-5 pb-5 pt-14 sm:px-6 sm:pb-6 md:border-b-0 md:border-r md:px-7 md:py-7 ${sidePanelBorderClass}`}>
            <div className={`absolute inset-0 ${sidePanelBackdropClass}`} />
            <div className="relative z-10 space-y-6">
              <div className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 backdrop-blur-xl ${brandChipClass}`}>
                <img
                  src={rideShareLogo}
                  alt={`${productName} logo`}
                  className="h-10 w-10 rounded-xl object-cover shadow-[0_10px_24px_-16px_rgba(15,23,42,0.45)]"
                  draggable="false"
                />
                <div>
                  <p className="text-sm font-semibold">{productName}</p>
                  <p className={`text-xs uppercase tracking-[0.24em] ${brandCaptionClass}`}>Safe • Fast • Verified</p>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className={`max-w-xs text-[1.95rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[2.35rem] ${sideTitleClass}`}>
                  {productName}
                </h2>
                <p className={`max-w-sm text-sm leading-6 ${sideBodyClass}`}>
                  Premium ride booking for passengers, drivers, and operators who want a cleaner flow from login to live trip control.
                </p>
              </div>

              <div className={sideFeatureCardClass}>
                <div className={`space-y-3 text-sm ${sideFeatureTextClass}`}>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${darkMode ? "bg-emerald-300/18 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>01</span>
                    <span>Choose pickup, drop, and ride type in one fast booking flow.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${darkMode ? "bg-rose-300/18 text-rose-200" : "bg-sky-100 text-sky-700"}`}>02</span>
                    <span>See live fare, ETA, and nearby driver activity before you confirm.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${darkMode ? "bg-violet-300/18 text-violet-200" : "bg-indigo-100 text-indigo-700"}`}>03</span>
                    <span>Track rides, earnings, and support updates across every role.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-col px-4 pb-4 pt-5 sm:px-5 sm:pb-5 md:px-6 md:py-6">
            <div className="space-y-4">
              <div className={`rounded-[24px] border p-1 backdrop-blur-xl ${tabsShellClass}`}>
                <div className="relative grid grid-cols-2 gap-1">
                  <motion.span
                    animate={{ x: currentMode === "login" ? "0%" : "100%" }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className={`absolute inset-y-0 left-0 z-0 w-1/2 rounded-[18px] ${tabsIndicatorClass}`}
                  />
                  {["login", "signup"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMode(item)}
                      className={`relative z-10 rounded-[18px] px-4 py-3 text-sm font-semibold transition ${currentMode === item ? darkMode ? "text-white" : "text-slate-950" : darkMode ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {item === "login" ? copy.loginTab : copy.signupTab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${fieldLabelClass}`}>
                      {currentMode === "login" ? "Login flow" : "Signup flow"}
                    </p>
                    <h3 id="auth-modal-title" className="mt-1 text-[1.55rem] font-bold tracking-[-0.03em] text-inherit">{content.title}</h3>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${stepChipClass}`}>
                    Step {activeStep} / {stepCount}
                  </div>
                </div>
                <p className={`max-w-md text-sm leading-6 ${textSubtleClass}`}>{content.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <AnimatePresence mode="wait">{currentMode === "login" ? renderLoginStep() : renderSignupStep()}</AnimatePresence>

              <div className="mt-4 space-y-3">
                {error ? <ToneMessage tone={errorTone}>{error}</ToneMessage> : null}
                {success ? <ToneMessage tone="success">{success}</ToneMessage> : null}
                {devOtpHint ? <ToneMessage tone="warning">{devOtpHint}</ToneMessage> : null}
              </div>
            </div>

            <div className={`sticky bottom-0 mt-4 space-y-3 border-t pt-4 ${darkMode ? "border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,0.92)_35%)]" : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(248,250,252,0.96)_35%)]"}`}>
              <GlowButton disabled={busy} onClick={handlePrimaryAction} darkMode={darkMode}>{primaryLabel}</GlowButton>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={secondaryAction}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${darkMode ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-500 hover:bg-slate-950/[0.05]"}`}
                >
                  {secondaryLabel}
                </button>
                {!isFinalStep ? (
                  <p className={`text-right text-xs ${textSubtleClass}`}>
                    {content.ctaPrompt} <span className="font-semibold text-inherit">{content.ctaAction}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

