import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { apiRequest, storeAuthSession } from "./api";
import { validateEmail, validatePassword } from "./utils/authValidation";

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

function resolveLoginErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  
  if (error?.payload && typeof error.payload === "object") {
      const messages = Object.values(error.payload);
      if (messages.length > 0) {
          return messages[0];
      }
  }
  return rawMessage || "Unable to login.";
}

export default function Login({ onLogin, labels = {}, defaultRole = "RIDER" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });
  const copy = {
    role: "Login as",
    rider: "Rider",
    driver: "Driver",
    email: "Email",
    password: "Password",
    loginAction: "Login",
    loginLoading: "Signing in...",
    ...labels,
  };
  const roleCards = [
    { value: "RIDER", label: copy.rider, hint: "Book your next trip" },
    { value: "DRIVER", label: copy.driver, hint: "Go online and earn" },
  ];
  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";

  useEffect(() => {
    setRole(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  }, [defaultRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextFieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setTouched({
      email: true,
      password: true,
    });
    if (nextFieldErrors.email || nextFieldErrors.password) {
      setError("Please fix the highlighted fields before logging in.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const payload = await apiRequest("/auth/login", "POST", { email, password, role });
      storeAuthSession(payload);
      onLogin?.(payload);
    } catch (requestError) {
      setError(resolveLoginErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-role-shell">
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
      </div>

      <div className="auth-field">
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={copy.email}
          className={`auth-input ${focusedField === "email" ? "auth-input--focused" : ""}`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={() => setFocusedField("email")}
          onBlur={() => {
            setFocusedField("");
            setTouched((previous) => ({ ...previous, email: true }));
          }}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "login-email-error" : undefined}
          required
        />
        {emailError && (
          <p id="login-email-error" className="mt-2 text-xs font-semibold text-rose-600">
            {emailError}
          </p>
        )}
      </div>

      <div className="auth-field">
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={copy.password}
          className={`auth-input ${focusedField === "password" ? "auth-input--focused" : ""}`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onFocus={() => setFocusedField("password")}
          onBlur={() => {
            setFocusedField("");
            setTouched((previous) => ({ ...previous, password: true }));
          }}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? "login-password-error" : undefined}
          required
        />
        {passwordError && (
          <p id="login-password-error" className="mt-2 text-xs font-semibold text-rose-600">
            {passwordError}
          </p>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {error ? (
          <MotionP
            key={`login-error-${error}`}
            className="auth-message auth-message--error"
            initial={{ opacity: 0, y: 10, filter: "blur(8px)", x: 0 }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {error}
          </MotionP>
        ) : null}
      </AnimatePresence>

      <MotionButton type="submit" className="auth-submit" disabled={loading} {...BUTTON_INTERACTION}>
        {loading ? copy.loginLoading : copy.loginAction}
      </MotionButton>
    </form>
  );
}
