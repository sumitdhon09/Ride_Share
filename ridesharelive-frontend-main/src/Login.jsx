import { useEffect, useState } from "react";
import { apiRequest } from "./api";

export default function Login({ onLogin, labels = {}, defaultRole = "RIDER" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole === "DRIVER" ? "DRIVER" : "RIDER");
  const [askLocation, setAskLocation] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(false);
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
    setError("");
    setLocationError("");
    setLoading(true);
    try {
      if (askLocation) {
        await requestLiveLocation();
      }

      const payload = await apiRequest("/auth/login", "POST", { email, password, role });
      const accessToken = payload.accessToken || payload.token || "";
      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", payload.refreshToken || "");
      localStorage.setItem("role", payload.role || "");
      localStorage.setItem("name", payload.name || "");
      localStorage.setItem("userId", String(payload.id || ""));
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
          type="email"
          placeholder="you@example.com"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="login-password">
          {copy.password}
        </label>
        <input
          id="login-password"
          type="password"
          placeholder="Enter your password"
          className="auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="auth-utility-card">
        <label className="auth-checkbox">
          <input
            type="checkbox"
            checked={askLocation}
            onChange={(event) => setAskLocation(event.target.checked)}
            className="auth-checkbox__control"
          />
          <span>{copy.locationPermission}</span>
        </label>
        <button
          type="button"
          className="auth-utility-action"
          onClick={requestLiveLocation}
        >
          {copy.useLocationNow}
        </button>
      </div>

      {locationError && (
        <p className="auth-message auth-message--warning">{locationError}</p>
      )}

      {error && <p className="auth-message auth-message--error">{error}</p>}

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? copy.loginLoading : copy.loginAction}
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
