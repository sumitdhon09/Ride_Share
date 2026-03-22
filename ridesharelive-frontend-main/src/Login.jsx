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

export default function Login({ onLogin, labels = {}, defaultRole = "RIDER" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  const [askLocation, setAskLocation] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
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
    locationPermission: "Ask for live location access",
    useLocationNow: "Use live location now",
    locationDenied: "Location permission denied. You can continue without it.",
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

  const requestLiveLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError(copy.locationDenied);
        resolve(null);
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
          setLocationError("");
          resolve(payload);
        },
        () => {
          setLocationError(copy.locationDenied);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

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
    setLocationError("");
    setLoading(true);
    try {
      if (askLocation) {
        await requestLiveLocation();
      }

      const payload = await apiRequest("/auth/login", "POST", { email, password, role });
      storeAuthSession(payload);
      onLogin?.(payload);
    } catch (requestError) {
      setError(requestError.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="login-email">
          {copy.email}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
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
        <label className="auth-field__label" htmlFor="login-password">
          {copy.password}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
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

      <MotionDiv className="auth-utility-card" whileHover={{ y: -1 }} transition={{ duration: 0.2 }}>
        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={askLocation}
            onChange={(event) => setAskLocation(event.target.checked)}
            className="auth-checkbox__control"
          />
          <span>{copy.locationPermission}</span>
        </label>
        <MotionButton type="button" className="auth-utility-action" onClick={requestLiveLocation} {...BUTTON_INTERACTION}>
          {copy.useLocationNow}
        </MotionButton>
      </MotionDiv>

      <AnimatePresence mode="popLayout">
        {locationError ? (
          <MotionP key={`login-location-${locationError}`} className="auth-message auth-message--warning" {...ALERT_TRANSITION}>
            {locationError}
          </MotionP>
        ) : null}
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
