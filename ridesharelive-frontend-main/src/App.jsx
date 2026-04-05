import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import heroImage from "./assets/1.png";
import safetyImage from "./assets/2.png";
import AuthModal from "./components/AuthModal";
import LiveMapPanel from "./components/LiveMapPanel";
import NotificationCenter from "./components/NotificationCenter";
import PremiumCursor from "./components/PremiumCursor";
import PremiumLanding from "./components/PremiumLanding";
import SettingsDrawer from "./components/settings/SettingsDrawer";
import AdminDashboard from "./pages/AdminDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import UserDashboard from "./pages/UserDashboard";
import { apiRequest } from "./api";
import {
  ACCENT_THEMES,
  buildDefaultSettingsDrawerSnapshot,
  buildSettingsDrawerSnapshot,
  getStoredLocalSettings,
  sanitizeLocalSettings,
  splitSettingsDrawerSnapshot,
} from "./utils/settingsDrawerState";
import { calculateRideFare, RIDE_OPTIONS } from "./utils/farePricing";

const MotionDiv = motion.div;
const PAGE_SWITCH_EASE = [0.22, 1, 0.36, 1];

const INITIAL_SESSION = {
  token: "",
  name: "",
  role: "",
  userId: "",
  email: "",
};

const DEFAULT_PREFERENCES = {
  theme: "dark-theme",
  language: "en",
  fontScale: 100,
};
const AVAILABLE_THEMES = ["peach-glow", "dark-theme"];
const DEFAULT_ADVANCED_SETTINGS = {
  tripSharingDefault: true,
  hidePhoneNumber: false,
  emergencyContact: "",
  defaultPaymentMethod: "upi",
  autoTipEnabled: false,
  invoiceEmailEnabled: true,
  mapStyle: "standard",
  avoidTolls: false,
  avoidHighways: false,
  preferredVehicleType: "mini",
  acPreference: "any",
  quietRide: false,
  deleteAccountRequested: false,
};
const USER_SETTINGS_PREFIXES = ["/user-settings", "/api/user-settings"];
const FALLBACK_TRANSLATION_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
];
const WEBSITE_LANGUAGE_CODES = new Set(FALLBACK_TRANSLATION_LANGUAGE_OPTIONS.map((option) => option.code.toLowerCase()));
const ADVANCED_SETTINGS_KEYS = Object.keys(DEFAULT_ADVANCED_SETTINGS);

let googleTranslateLoaderPromise = null;

function isNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("404") || message.includes("not found");
}

function loadGoogleTranslateWidget() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.google?.translate?.TranslateElement) {
    return Promise.resolve(true);
  }

  if (googleTranslateLoaderPromise) {
    return googleTranslateLoaderPromise;
  }

  googleTranslateLoaderPromise = new Promise((resolve) => {
    let settled = false;
    const safeResolve = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    window.__googleTranslateElementInit = () => {
      try {
        const mountNode = document.getElementById("google_translate_element");
        if (mountNode && !mountNode.dataset.initialized) {
          // Loads Google page translation UI engine once, then we control it programmatically.
          new window.google.translate.TranslateElement(
            { pageLanguage: "en", autoDisplay: false },
            "google_translate_element"
          );
          mountNode.dataset.initialized = "true";
        }
        safeResolve(true);
      } catch {
        safeResolve(false);
      }
    };

    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "https://translate.google.com/translate_a/element.js?cb=__googleTranslateElementInit";
      script.async = true;
      script.onerror = () => safeResolve(false);
      document.head.appendChild(script);
    }

    setTimeout(() => safeResolve(false), 12000);
  });

  return googleTranslateLoaderPromise;
}

function useRevealItems(rootRef, depsKey = "") {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(root.querySelectorAll("[data-reveal]"));
    if (items.length === 0) {
      return undefined;
    }

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      items.forEach((item) => {
        item.classList.add("reveal-ready", "is-visible");
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    items.forEach((item, index) => {
      item.classList.add("reveal-ready");
      item.classList.remove("is-visible");
      item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 420)}ms`);
      if (item.dataset.reveal === "instant") {
        requestAnimationFrame(() => item.classList.add("is-visible"));
        return;
      }
      observer.observe(item);
    });

    return () => observer.disconnect();
  }, [depsKey, rootRef]);
}

function ThemeIcon({ dark }) {
  if (dark) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12.8A9 9 0 1 1 11.2 3a7.2 7.2 0 0 0 9.8 9.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.1M12 19.15v2.1M4.85 4.85l1.5 1.5M17.65 17.65l1.5 1.5M2.75 12h2.1M19.15 12h2.1M4.85 19.15l1.5-1.5M17.65 6.35l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThemeToggleSwitch({ dark, onToggle, label, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      className={`theme-toggle theme-toggle--switch ${dark ? "is-dark" : "is-light"} ${className}`.trim()}
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__mode theme-toggle__mode--light">
          <ThemeIcon dark={false} />
        </span>
        <span className="theme-toggle__mode theme-toggle__mode--dark">
          <ThemeIcon dark />
        </span>
        <span className="theme-toggle__thumb">
          <ThemeIcon dark={dark} />
        </span>
      </span>
    </button>
  );
}

const TRANSLATIONS = {
  en: {
    header: {
      product: "RideShare",
      subtitle: "click. ride. arrive.",
      loginSignup: "Login",
      logout: "Logout",
      settings: "Settings",
      close: "Close",
      user: "User",
    },
    settings: {
      title: "Settings Bar",
      theme: "Theme",
      language: "Language",
      fontSize: "Font size",
      decrease: "A-",
      increase: "A+",
      reset: "Reset",
      themeOptions: {
        "peach-glow": "Peach Glow Theme",
        "eco-friendly-ride": "Eco-Friendly Ride Theme",
        "dark-theme": "Dark Theme",
        "urban-transport": "Urban Transport Theme",
      },
      languageOptions: {
        en: "English",
        hi: "Hindi",
      },
    },
    auth: {
      welcomeBack: "Welcome back",
      createAccountHeading: "Create your account",
      loginTab: "Login",
      signupTab: "Sign up",
      loginSubtitle: "Enter your credentials",
      signupSubtitle: "Create your passenger, driver, or admin profile",
      switchToSignupPrompt: "Don't have an account?",
      switchToLoginPrompt: "Already have an account?",
      switchToSignupAction: "Sign Up",
      switchToLoginAction: "Login",
      fullName: "Full name",
      email: "Email",
      password: "Password",
      role: "Role",
      rider: "Passenger",
      user: "Passenger",
      driver: "Driver",
      locationPermission: "Ask for live location access",
      useLocationNow: "Use live location now",
      locationDenied: "Location permission denied. You can continue without it.",
      loginAction: "Login",
      loginLoading: "Signing in...",
      createAccountAction: "Create account",
      createAccountLoading: "Creating...",
      signupSuccess: "Signup successful. Please login.",
    },
    home: {
      badge: "Real-time mobility",
      heroTitleA: "Rides that feel instant.",
      heroTitleB: "Operations that stay calm.",
      heroBody:
        "One app for riders and drivers, designed for speed, clarity, and trust across every trip.",
      heroBookRideCta: "Book a Ride",
      heroDriveEarnCta: "Drive & Earn",
      heroLoginCta: "Login",
      heroSignupCta: "Create account",
      quickEstimatorEyebrow: "Ride estimator",
      quickEstimatorTitle: "Quick fare and ETA estimate",
      quickEstimatorBody: "Enter your trip details and get an instant, no-signup estimate.",
      quickEstimatorPickupLabel: "Pickup",
      quickEstimatorPickupPlaceholder: "e.g. Kharadi, Pune",
      quickEstimatorDropLabel: "Drop",
      quickEstimatorDropPlaceholder: "e.g. Viman Nagar, Pune",
      quickEstimatorDistanceLabel: "Distance (km)",
      quickEstimatorVehicleLabel: "Vehicle",
      quickEstimatorBike: "Bike",
      quickEstimatorMini: "Mini",
      quickEstimatorSedan: "Sedan",
      quickEstimatorEtaLabel: "Estimated arrival",
      quickEstimatorFareLabel: "Estimated fare",
      quickEstimatorBookCta: "Book this ride",
      quickEstimatorHint: "Actual fare may vary with traffic, tolls, and surge.",
      appDemoEyebrow: "App preview",
      appDemoTitle: "See the booking flow before you sign in",
      appDemoBody: "A quick visual walkthrough from request to in-ride safety view.",
      appDemoRideTitle: "Booking and match",
      appDemoRideBody: "Pick route, confirm, and get matched with a nearby driver.",
      appDemoSafetyTitle: "Live ride confidence",
      appDemoSafetyBody: "Track the route and key ride status updates in real time.",
      highlights: [
        { label: "Average pickup", value: "6 min" },
        { label: "Coverage", value: "100+ zones" },
        { label: "Completed rides", value: "1M+" },
      ],
      steps: [
        {
          title: "Book in 10 seconds",
          detail: "Choose pickup, drop, and mode in one clean flow.",
        },
        {
          title: "Track every ride",
          detail: "Live status updates from request to completion.",
        },
        {
          title: "Driver-first operations",
          detail: "Fast accept, start, and complete controls for captains.",
        },
      ],
      safetyTitle: "Safety by default",
      safetyBody:
        "Driver verification, ride history trails, and always-visible ride state keep both sides informed.",
      rolesTitle: "Built for both roles",
      riderModeTitle: "Passenger mode",
      riderModeBody: "Book quickly, watch real-time status, and review complete trip history.",
      driverModeTitle: "Driver mode",
      driverModeBody: "Accept demand, update ride milestones, and monitor personal earnings.",
      adminModeTitle: "Admin mode",
      adminModeBody: "Oversee riders, drivers, live operations, and platform health from one command center.",
      mapTitle: "Live map",
      mapSearchPlaceholder: "Search or type pickup location",
      mapUseMyLocation: "Use My Location",
      mapRecenter: "Recenter",
      mapLocateFailed: "Location access failed.",
      mapSearchFailed: "Unable to search this location.",
      mapIndiaOnly: "Only India locations are supported on this map.",
      mapYourLocation: "Your location",
    },
    footer: {
      copyright: "Copyright 2026 Ride Share Live.",
    },
  },
  hi: {
    header: {
      product: "RideShare",
      subtitle: "click. ride. arrive.",
      loginSignup: "लॉगिन",
      logout: "लॉगआउट",
      settings: "सेटिंग्स",
      close: "बंद करें",
      user: "यूज़र",
    },
    settings: {
      title: "सेटिंग्स बार",
      theme: "थीम",
      language: "भाषा",
      fontSize: "फ़ॉन्ट साइज़",
      decrease: "A-",
      increase: "A+",
      reset: "रीसेट",
      themeOptions: {
        "eco-friendly-ride": "Eco-Friendly Ride Theme",
        "dark-theme": "Dark Theme",
        "urban-transport": "Urban Transport Theme",
      },
      languageOptions: {
        en: "अंग्रेज़ी",
        hi: "हिंदी",
      },
    },
    auth: {
      welcomeBack: "वापसी पर स्वागत है",
      createAccountHeading: "अपना अकाउंट बनाएं",
      loginTab: "लॉगिन",
      signupTab: "साइन अप",
      loginSubtitle: "अपनी जानकारी दर्ज करें",
      signupSubtitle: "राइडर या ड्राइवर प्रोफाइल बनाएं",
      switchToSignupPrompt: "क्या आपका अकाउंट नहीं है?",
      switchToLoginPrompt: "क्या आपका अकाउंट पहले से है?",
      switchToSignupAction: "साइन अप",
      switchToLoginAction: "लॉगिन",
      fullName: "पूरा नाम",
      email: "ईमेल",
      password: "पासवर्ड",
      role: "रोल",
      rider: "यात्री",
      driver: "ड्राइवर",
      locationPermission: "लाइव लोकेशन एक्सेस पूछें",
      useLocationNow: "अभी लाइव लोकेशन लें",
      locationDenied: "लोकेशन अनुमति नहीं मिली। आप इसके बिना भी जारी रख सकते हैं।",
      loginAction: "लॉगिन",
      loginLoading: "साइन इन हो रहा है...",
      createAccountAction: "अकाउंट बनाएं",
      createAccountLoading: "बन रहा है...",
      signupSuccess: "साइनअप सफल हुआ। कृपया लॉगिन करें।",
    },
    home: {
      badge: "रीयल-टाइम मोबिलिटी",
      heroTitleA: "राइड तुरंत मिले।",
      heroTitleB: "ऑपरेशंस रहें आसान।",
      heroBody:
        "राइडर और ड्राइवर दोनों के लिए एक ऐप, जो स्पीड, स्पष्टता और भरोसे के साथ बनाया गया है।",
      heroLoginCta: "जारी रखने के लिए लॉगिन करें",
      heroSignupCta: "अकाउंट बनाएं",
      highlights: [
        { label: "औसत पिकअप", value: "6 मिनट" },
        { label: "कवरेज", value: "100+ ज़ोन" },
        { label: "पूरी राइड्स", value: "1M+" },
      ],
      steps: [
        {
          title: "10 सेकंड में बुक करें",
          detail: "एक ही फ्लो में पिकअप, ड्रॉप और मोड चुनें।",
        },
        {
          title: "हर राइड ट्रैक करें",
          detail: "रिक्वेस्ट से कंप्लीट तक लाइव स्टेटस अपडेट।",
        },
        {
          title: "ड्राइवर-फर्स्ट ऑपरेशंस",
          detail: "तेज़ी से एक्सेप्ट, स्टार्ट और कंप्लीट कंट्रोल।",
        },
      ],
      safetyTitle: "सेफ्टी डिफ़ॉल्ट में",
      safetyBody:
        "ड्राइवर वेरिफिकेशन, राइड हिस्ट्री और साफ़ स्टेटस दोनों पक्षों को हमेशा जानकारी में रखते हैं।",
      rolesTitle: "दोनों रोल के लिए बना",
      riderModeTitle: "यात्री मोड",
      riderModeBody: "जल्दी बुक करें, लाइव स्टेटस देखें और पूरी राइड हिस्ट्री पाएं।",
      driverModeTitle: "ड्राइवर मोड",
      driverModeBody: "डिमांड एक्सेप्ट करें, स्टेटस अपडेट करें और कमाई ट्रैक करें।",
      adminModeTitle: "एडमिन मोड",
      adminModeBody: "राइडर्स, ड्राइवर्स, लाइव ऑपरेशन्स और पूरे प्लेटफॉर्म की निगरानी एक ही कमांड सेंटर से करें।",
      mapTitle: "लाइव मैप",
      mapSearchPlaceholder: "पिकअप लोकेशन खोजें या टाइप करें",
      mapUseMyLocation: "मेरी लोकेशन",
      mapRecenter: "रीसेंटर",
      mapLocateFailed: "लोकेशन एक्सेस असफल हुआ।",
      mapSearchFailed: "इस लोकेशन को खोजा नहीं जा सका।",
      mapIndiaOnly: "इस मैप पर केवल भारत की लोकेशन समर्थित हैं।",
      mapYourLocation: "आपकी लोकेशन",
    },
    footer: {
      copyright: "कॉपीराइट 2026 राइडशेयर लाइव।",
    },
  },
};

function getStoredSession() {
  return {
    token: localStorage.getItem("token") || "",
    name: localStorage.getItem("name") || "",
    role: (localStorage.getItem("role") || "").toUpperCase(),
    userId: localStorage.getItem("userId") || "",
    email: localStorage.getItem("email") || "",
  };
}

function getAccessibleWorkspaces(role) {
  if (role === "ADMIN") {
    return ["user", "driver", "admin"];
  }
  if (role === "DRIVER") {
    return ["user", "driver"];
  }
  if (role === "RIDER" || role === "USER") {
    return ["user"];
  }
  return [];
}

function getDefaultPageForRole(role) {
  if (role === "ADMIN") {
    return "admin";
  }
  if (role === "DRIVER") {
    return "driver";
  }
  const accessibleWorkspaces = getAccessibleWorkspaces(role);
  if (accessibleWorkspaces.includes("user")) {
    return "user";
  }
  return accessibleWorkspaces[0] || "home";
}

function isPageAllowedForRole(page, role) {
  return getAccessibleWorkspaces(role).includes(page) || page === "home";
}

function normalizeLanguageCode(languageCode) {
  const normalized = typeof languageCode === "string" ? languageCode.trim() : "";
  if (!normalized) {
    return DEFAULT_PREFERENCES.language;
  }
  if (normalized.length > 20 || !/^[a-z-]+$/i.test(normalized)) {
    return DEFAULT_PREFERENCES.language;
  }
  if (!WEBSITE_LANGUAGE_CODES.has(normalized.toLowerCase())) {
    return DEFAULT_PREFERENCES.language;
  }
  return normalized;
}

function sanitizeAdvancedSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const sanitized = { ...DEFAULT_ADVANCED_SETTINGS };
  ADVANCED_SETTINGS_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      sanitized[key] = source[key];
    }
  });
  return sanitized;
}

function getStoredPreferences() {
  const storedTheme = localStorage.getItem("theme");
  const storedLanguage = localStorage.getItem("language");

  return {
    theme: AVAILABLE_THEMES.includes(storedTheme) ? storedTheme : DEFAULT_PREFERENCES.theme,
    language: normalizeLanguageCode(storedLanguage),
    fontScale: DEFAULT_PREFERENCES.fontScale,
  };
}

function getStoredAdvancedSettings() {
  const raw = localStorage.getItem("advancedSettings");
  if (!raw) {
    return sanitizeAdvancedSettings();
  }

  try {
    const parsed = JSON.parse(raw);
    return sanitizeAdvancedSettings(parsed);
  } catch {
    return sanitizeAdvancedSettings();
  }
}

function clearSessionStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("name");
  localStorage.removeItem("role");
  localStorage.removeItem("userId");
  localStorage.removeItem("email");
}

function renderAnimatedWords(text, extraClassName = "") {
  return String(text || "")
    .split(" ")
    .filter(Boolean)
    .map((word, index) => (
      <span
        key={`${word}-${index}`}
        data-hero-word
        className={`inline-block pr-[0.22em] ${extraClassName}`.trim()}
      >
        {word}
      </span>
    ));
}

function normalizeEstimatorVehicle(vehicle) {
  if (vehicle === "mini") {
    return "hatchback";
  }
  return vehicle;
}

function buildFallbackEstimate(distanceKm, vehicle) {
  const parsedDistance = Number(distanceKm);
  const normalizedDistance =
    Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 1;
  const normalizedVehicle = normalizeEstimatorVehicle(vehicle);
  const vehicleOption = RIDE_OPTIONS.find((item) => item.id === normalizedVehicle || item.type === normalizedVehicle);
  const estimatedFare = calculateRideFare(normalizedDistance, normalizedVehicle, false);
  const baseEta = vehicleOption?.eta ?? 5;
  const etaMinutes = Math.max(baseEta + Math.round(normalizedDistance * 0.9), baseEta + 2);
  const fareVariance = Math.max(Math.round(estimatedFare * 0.12), 10);

  return {
    distance: normalizedDistance.toFixed(1),
    etaText: `${etaMinutes}-${etaMinutes + 4} min`,
    fareLow: Math.max(estimatedFare - fareVariance, vehicleOption?.minimumFare ?? 0),
    fareHigh: estimatedFare + fareVariance,
  };
}

function HomeLanding({ onOpenAuth, copy }) {
  const heroRef = useRef(null);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [distanceKm, setDistanceKm] = useState("8");
  const [vehicle, setVehicle] = useState("mini");
  const [estimateLoading, setEstimateLoading] = useState(false);

  const fallbackEstimate = useMemo(() => buildFallbackEstimate(distanceKm, vehicle), [distanceKm, vehicle]);
  const [estimatedTrip, setEstimatedTrip] = useState(fallbackEstimate);

  useEffect(() => {
    setEstimatedTrip(fallbackEstimate);
  }, [fallbackEstimate]);

  useEffect(() => {
    let cancelled = false;
    const parsedDistance = Number(distanceKm);
    if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      setEstimateLoading(false);
      setEstimatedTrip(fallbackEstimate);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setEstimateLoading(true);
      try {
        const estimate = await apiRequest(
          `/rides/estimate?distanceKm=${encodeURIComponent(parsedDistance.toFixed(2))}&rideType=${encodeURIComponent(vehicle)}`
        );
        const fareMin = Number(estimate?.fareMin);
        const fareMax = Number(estimate?.fareMax);
        const etaMin = Number(estimate?.etaMinMinutes);
        const etaMax = Number(estimate?.etaMaxMinutes);
        const apiDistance = Number(estimate?.distanceKm);

        if (
          Number.isFinite(fareMin) &&
          Number.isFinite(fareMax) &&
          Number.isFinite(etaMin) &&
          Number.isFinite(etaMax)
        ) {
          if (!cancelled) {
            setEstimatedTrip({
              distance: (Number.isFinite(apiDistance) ? apiDistance : parsedDistance).toFixed(1),
              etaText: `${etaMin}-${etaMax} min`,
              fareLow: Math.round(fareMin),
              fareHigh: Math.round(fareMax),
            });
          }
          return;
        }
      } catch {
        // Fallback estimate is kept when API is unavailable.
      } finally {
        if (!cancelled) {
          setEstimateLoading(false);
        }
      }

      if (!cancelled) {
        setEstimatedTrip(fallbackEstimate);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [distanceKm, fallbackEstimate, vehicle]);

  const text = {
    heroBookRideCta: copy.heroBookRideCta || "Book a Ride",
    heroDriveEarnCta: copy.heroDriveEarnCta || "Drive & Earn",
    heroLoginCta: copy.heroLoginCta || "Login",
    heroSignupCta: copy.heroSignupCta || "Create account",
    quickEstimatorEyebrow: copy.quickEstimatorEyebrow || "Ride estimator",
    quickEstimatorTitle: copy.quickEstimatorTitle || "Quick fare and ETA estimate",
    quickEstimatorBody:
      copy.quickEstimatorBody ||
      "Enter your trip details and get an instant, no-signup estimate.",
    quickEstimatorPickupLabel: copy.quickEstimatorPickupLabel || "Pickup",
    quickEstimatorPickupPlaceholder:
      copy.quickEstimatorPickupPlaceholder || "e.g. Kharadi, Pune",
    quickEstimatorDropLabel: copy.quickEstimatorDropLabel || "Drop",
    quickEstimatorDropPlaceholder: copy.quickEstimatorDropPlaceholder || "e.g. Viman Nagar, Pune",
    quickEstimatorDistanceLabel: copy.quickEstimatorDistanceLabel || "Distance (km)",
    quickEstimatorVehicleLabel: copy.quickEstimatorVehicleLabel || "Vehicle",
    quickEstimatorBike: copy.quickEstimatorBike || "Bike",
    quickEstimatorMini: copy.quickEstimatorMini || "Mini",
    quickEstimatorSedan: copy.quickEstimatorSedan || "Sedan",
    quickEstimatorEtaLabel: copy.quickEstimatorEtaLabel || "Estimated arrival",
    quickEstimatorFareLabel: copy.quickEstimatorFareLabel || "Estimated fare",
    quickEstimatorBookCta: copy.quickEstimatorBookCta || "Book this ride",
    quickEstimatorHint:
      copy.quickEstimatorHint || "Actual fare may vary with traffic, tolls, and surge.",
    appDemoEyebrow: copy.appDemoEyebrow || "App preview",
    appDemoTitle: copy.appDemoTitle || "See the booking flow before you sign in",
    appDemoBody:
      copy.appDemoBody || "A quick visual walkthrough from request to in-ride safety view.",
    appDemoRideTitle: copy.appDemoRideTitle || "Booking and match",
    appDemoRideBody:
      copy.appDemoRideBody || "Pick route, confirm, and get matched with a nearby driver.",
    appDemoSafetyTitle: copy.appDemoSafetyTitle || "Live ride confidence",
    appDemoSafetyBody:
      copy.appDemoSafetyBody || "Track the route and key ride status updates in real time.",
  };
  const routeLabel =
    pickup.trim() && drop.trim() ? `${pickup.trim()} to ${drop.trim()}` : "Kharadi to Viman Nagar";
  const stats = Array.isArray(copy.highlights) ? copy.highlights : [];
  const steps = Array.isArray(copy.steps) ? copy.steps : [];
  const heroChips = [text.quickEstimatorTitle, "Responsive live dispatch", "Premium web dashboard"];
    const signalCards = [
      {
        label: "Dispatch pulse",
        value: estimatedTrip.etaText,
        detail: "Current arrival band",
    },
    {
      label: "Fare window",
      value: `Rs ${estimatedTrip.fareLow}-${estimatedTrip.fareHigh}`,
      detail: "Live quote preview",
    },
    {
      label: "Trip mode",
      value: vehicle.toUpperCase(),
        detail: "Switch vehicle instantly",
      },
    ];

  useEffect(() => {
    const root = heroRef.current;
    if (!root) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll("[data-home-hero-reveal]"),
        { autoAlpha: 0, y: 26 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
        }
      );

      gsap.fromTo(
        root.querySelectorAll("[data-home-hero-chip]"),
        { autoAlpha: 0, y: 12, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          stagger: 0.07,
          delay: 0.15,
          ease: "power2.out",
        }
      );

      gsap.to(root.querySelectorAll("[data-home-hero-glow]"), {
        xPercent: 5,
        yPercent: -8,
        repeat: -1,
        yoyo: true,
        duration: 4.6,
        ease: "sine.inOut",
        stagger: 0.3,
      });
    }, root);

    return () => ctx.revert();
  }, []);
    const roleOptions = [
      {
        key: "RIDER",
        eyebrow: "Rider access",
        title: "Choose rider mode",
        body: "Book quickly, track your trip live, and keep your travel history visible.",
        primaryLabel: "Rider signup",
        secondaryLabel: "Rider login",
      },
      {
        key: "DRIVER",
        eyebrow: "Driver access",
        title: "Choose driver mode",
        body: "Go online, accept requests, and manage active rides from one workspace.",
        primaryLabel: "Driver signup",
        secondaryLabel: "Driver login",
      },
      {
        key: "ADMIN",
        eyebrow: "Admin access",
        title: "Choose admin mode",
        body: "Review platform activity, supervise live operations, and manage approvals from one console.",
        primaryLabel: "Admin signup",
        secondaryLabel: "Admin login",
      },
    ];

    return (
      <section className="space-y-8" ref={heroRef}>
      <div className="landing-stage landing-stage--wide landing-stage--hero" data-reveal>
        <div data-home-hero-glow className="landing-hero-glow landing-hero-glow--amber" />
        <div data-home-hero-glow className="landing-hero-glow landing-hero-glow--cyan" />
        <p className="eyebrow-chip" data-home-hero-reveal>{copy.badge}</p>

        <div className="landing-hero-grid mt-7">
          <div className="space-y-6">
            <div className="hero-billboard" data-home-hero-reveal>
              <div className="hero-billboard__frame">
                <div className="hero-billboard__meta">
                  <span className="hero-billboard__meta-chip">Urban mobility</span>
                  <span className="hero-billboard__meta-line" />
                </div>
                <div className="hero-billboard__brand">
                  <span className="hero-billboard__icon" aria-hidden="true">
                    <span className="hero-billboard__icon-dot hero-billboard__icon-dot--start" />
                    <span className="hero-billboard__icon-path" />
                    <span className="hero-billboard__icon-dot hero-billboard__icon-dot--end" />
                  </span>
                  <div>
                    <p className="hero-billboard__word">RIDESHARE</p>
                    <p className="hero-billboard__tagline">click. ride. arrive.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-editorial" data-home-hero-reveal>
              <h1 className="hero-editorial__title">
                <span>{copy.heroTitleA}</span>
                <span className="hero-editorial__accent">{copy.heroTitleB}</span>
              </h1>
              <p className="hero-editorial__body">{copy.heroBody}</p>
            </div>

            <div className="landing-hero-chip-row" data-home-hero-reveal>
              {heroChips.map((chip) => (
                <span key={chip} className="landing-hero-chip" data-home-hero-chip>
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-3" data-home-hero-reveal>
              <button className="btn-primary shadow-[0_18px_34px_-18px_rgba(15,23,42,0.38)]" onClick={() => onOpenAuth("signup", "RIDER")}>
                {text.heroBookRideCta}
              </button>
              <button className="btn-secondary" onClick={() => onOpenAuth("signup", "DRIVER")}>
                {text.heroDriveEarnCta}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" data-home-hero-reveal>
              <button className="font-semibold text-slate-700 underline underline-offset-2" onClick={() => onOpenAuth("login")}>
                {text.heroLoginCta}
              </button>
              <span className="text-slate-400">|</span>
              <button className="font-semibold text-slate-700 underline underline-offset-2" onClick={() => onOpenAuth("signup")}>
                {text.heroSignupCta}
              </button>
            </div>

            <div className="landing-hero-stats" data-home-hero-reveal>
              {stats.slice(0, 3).map((item) => (
                <article key={item.label} className="landing-hero-stat">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-hero-aside" data-home-hero-reveal>
            <article className="landing-hero-spotlight">
              <div className="landing-hero-spotlight__top">
                <div>
                  <p className="landing-hero-spotlight__eyebrow">Live booking pulse</p>
                  <h2 className="landing-hero-spotlight__title">{routeLabel}</h2>
                </div>
                <span className="landing-hero-spotlight__badge">Real-time</span>
              </div>
              <div className="landing-hero-spotlight__metrics">
                <article>
                  <span>ETA</span>
                  <strong>{estimatedTrip.etaText}</strong>
                </article>
                <article>
                  <span>Fare</span>
                  <strong>Rs {estimatedTrip.fareLow}-{estimatedTrip.fareHigh}</strong>
                </article>
                <article>
                  <span>Mode</span>
                  <strong>{vehicle.toUpperCase()}</strong>
                </article>
              </div>
              <div className="landing-hero-spotlight__footer">
                <span>Shortest path aware</span>
                <span>Responsive web layout</span>
              </div>
            </article>
          </div>
        </div>

      </div>

      <div className="landing-map-grid" data-reveal>
        <LiveMapPanel
          title={copy.mapTitle}
          defaultCenter={{ lat: 21.774, lon: 78.257 }}
          defaultZoom={6}
          defaultLocationLabel="Multai, India"
          className="landing-map-panel"
          labels={{
            searchPlaceholder: copy.mapSearchPlaceholder,
            useMyLocation: copy.mapUseMyLocation,
            recenter: copy.mapRecenter,
            locateFailed: copy.mapLocateFailed,
            searchFailed: copy.mapSearchFailed,
            indiaOnly: copy.mapIndiaOnly,
            yourLocation: copy.mapYourLocation,
          }}
        />
        <aside className="glass-panel card-rise landing-map-side p-5 sm:p-6" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Map intelligence</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">Inspect the ride zone before signup</h3>
          <p className="mt-3 text-sm text-slate-600">
            Route context, street view, and local place discovery now sit higher in the page so coverage is obvious
            before the rest of the product story.
          </p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[1.35rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Coverage</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Cities, towns, and smaller nearby places inside India</p>
            </div>
            <div className="rounded-[1.35rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Controls</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Lighter map, street view, search, and recenter actions</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="landing-role-shell glass-panel card-rise p-5 sm:p-6" data-reveal>
        <div className="landing-role-shell__intro">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Access modes</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">Choose the workflow that matches how you use RideShare</h3>
          <p className="mt-2 text-sm text-slate-600">
            One cleaner split for booking on the user side and handling requests on the driver side.
          </p>
        </div>
        <div className="role-gateway landing-role-shell__grid">
          {roleOptions.map((option) => (
            <article key={option.key} className="role-gateway__card">
              <p className="role-gateway__eyebrow">{option.eyebrow}</p>
              <h2 className="role-gateway__title">{option.title}</h2>
              <p className="role-gateway__body">{option.body}</p>
              <div className="role-gateway__actions">
                <button className="btn-primary" onClick={() => onOpenAuth("signup", option.key)}>
                  {option.primaryLabel}
                </button>
                <button className="btn-secondary" onClick={() => onOpenAuth("login", option.key)}>
                  {option.secondaryLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="landing-lower-grid">
        <div className="glass-panel card-rise landing-preview p-5 sm:p-6" data-reveal>
          <div className="landing-preview__frame">
            <img src={heroImage} alt="Ride matching preview" className="h-72 w-full rounded-[1.6rem] object-cover sm:h-80" />
            <div className="landing-preview__overlay">
              <p className="landing-preview__kicker">{text.appDemoEyebrow}</p>
              <h2 className="landing-preview__title">{text.appDemoTitle}</h2>
              <p className="landing-preview__body">{text.appDemoBody}</p>
            </div>
          </div>
        </div>

        <div className="route-sculpture route-sculpture--lower" data-reveal>
          <div className="route-sculpture__noise route-sculpture__noise--lower" />
          <div className="route-sculpture__card">
            <p className="route-sculpture__eyebrow">Dispatch board</p>
            <div className="route-sculpture__line">
              <span className="route-sculpture__dot route-sculpture__dot--start" />
              <span className="route-sculpture__trail" />
              <span className="route-sculpture__dot route-sculpture__dot--end" />
            </div>
            <div className="mt-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Route preview</p>
                <p className="mt-2 text-2xl font-bold leading-tight text-slate-900">{routeLabel}</p>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                live
              </div>
            </div>
            <div className="mt-8 grid gap-4">
              {signalCards.map((item) => (
                <article key={item.label} className="route-sculpture__metric">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
                  </div>
                  <p className="text-right text-sm text-slate-500">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel card-rise signal-radar p-6 sm:p-8" data-reveal>
        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">How it works</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">A faster flow from route choice to live ride tracking</h3>
            <p className="mt-2 text-sm text-slate-600">
              Clear trip steps, calmer cards, and one stronger visual language make the booking journey easier to scan.
            </p>
          </div>

          <div className="signal-radar__summary" data-reveal>
            <article className="signal-radar__summary-card">
              <span>Ready in</span>
              <strong>3 taps</strong>
            </article>
            <article className="signal-radar__summary-card">
              <span>Pickup band</span>
              <strong>{estimatedTrip.etaText}</strong>
            </article>
            <article className="signal-radar__summary-card">
              <span>Fare window</span>
              <strong>Rs {estimatedTrip.fareLow}-{estimatedTrip.fareHigh}</strong>
            </article>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {steps.map((step, index) => (
            <article key={step.title} className="signal-step" data-reveal>
              <div className="signal-step__index">0{index + 1}</div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{step.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.25fr,0.75fr]">
        <div className="glass-panel card-rise p-6 sm:p-8" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.quickEstimatorEyebrow}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{text.quickEstimatorTitle}</h3>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">{text.quickEstimatorBody}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              {text.quickEstimatorPickupLabel}
              <input
                type="text"
                value={pickup}
                onChange={(event) => setPickup(event.target.value)}
                placeholder={text.quickEstimatorPickupPlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {text.quickEstimatorDropLabel}
              <input
                type="text"
                value={drop}
                onChange={(event) => setDrop(event.target.value)}
                placeholder={text.quickEstimatorDropPlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {text.quickEstimatorDistanceLabel}
              <input
                type="number"
                min="1"
                step="0.5"
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {text.quickEstimatorVehicleLabel}
              <select
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                <option value="bike">{text.quickEstimatorBike}</option>
                <option value="mini">{text.quickEstimatorMini}</option>
                <option value="sedan">{text.quickEstimatorSedan}</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-sm text-slate-500">
              {(pickup.trim() && drop.trim()
                ? `${pickup.trim()} to ${drop.trim()}`
                : "Route preview")} | {estimatedTrip.distance} km
            </p>
            {estimateLoading && (
              <p className="mt-2 text-xs font-semibold text-slate-500">Syncing estimate from server...</p>
            )}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.quickEstimatorEtaLabel}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{estimatedTrip.etaText}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.quickEstimatorFareLabel}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  Rs {estimatedTrip.fareLow} - Rs {estimatedTrip.fareHigh}
                </p>
              </div>
            </div>
            <button className="btn-primary mt-5" onClick={() => onOpenAuth("signup", "RIDER")}>
              {text.quickEstimatorBookCta}
            </button>
            <p className="mt-3 text-xs text-slate-500">{text.quickEstimatorHint}</p>
          </div>
        </div>

        <div className="glass-panel card-rise signal-radar p-6 sm:p-8" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.appDemoEyebrow}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">Trip signal board</h3>
          <p className="mt-2 text-sm text-slate-600">
            A brighter pre-booking surface for riders and drivers: route confidence, match progress, and ETA in one frame.
          </p>
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. Route selected</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="shine-line h-full w-4/5 rounded-full bg-amber-500" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. Driver matched</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="shine-line h-full w-3/5 rounded-full bg-emerald-500" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. Ride in progress</p>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="shine-line h-full w-2/5 rounded-full bg-sky-500" />
              </div>
            </div>
          </div>
          <div className="signal-radar__grid mt-6">
            <div className="signal-radar__cell" data-reveal>
              <span>89%</span>
              <p>On-time pickups</p>
            </div>
            <div className="signal-radar__cell" data-reveal>
              <span>24/7</span>
              <p>Safety watch</p>
            </div>
            <div className="signal-radar__cell" data-reveal>
              <span>4.9</span>
              <p>Avg trip rating</p>
            </div>
            <div className="signal-radar__cell" data-reveal>
              <span>3 tap</span>
              <p>Booking flow</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel card-rise p-6 sm:p-8" data-reveal>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
            <img src={heroImage} alt="Booking and matching screenshot" className="h-56 w-full object-cover sm:h-64" />
            <div className="p-4">
              <h4 className="text-lg font-bold text-slate-900">{text.appDemoRideTitle}</h4>
              <p className="mt-2 text-sm text-slate-600">{text.appDemoRideBody}</p>
            </div>
          </article>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
            <img src={safetyImage} alt="Live tracking and safety screenshot" className="h-56 w-full object-cover sm:h-64" />
            <div className="p-4">
              <h4 className="text-lg font-bold text-slate-900">{text.appDemoSafetyTitle}</h4>
              <p className="mt-2 text-sm text-slate-600">{text.appDemoSafetyBody}</p>
            </div>
          </article>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-1">
        <div className="glass-panel card-rise p-6 sm:p-8" data-reveal>
          <h3 className="text-xl font-bold text-slate-900">{copy.rolesTitle}</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.riderModeTitle}</p>
              <p className="mt-2 text-sm text-slate-700">{copy.riderModeBody}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.driverModeTitle}</p>
              <p className="mt-2 text-sm text-slate-700">{copy.driverModeBody}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{copy.adminModeTitle || "Admin mode"}</p>
              <p className="mt-2 text-sm text-slate-700">{copy.adminModeBody || ""}</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

function MinimalHomeLanding({ onOpenAuth, copy }) {
  const landingRef = useRef(null);
  const [pickup, setPickup] = useState("Kharadi, Pune");
  const [drop, setDrop] = useState("Viman Nagar, Pune");
  const [distanceKm, setDistanceKm] = useState("8");
  const [vehicle, setVehicle] = useState("mini");
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimatedTrip, setEstimatedTrip] = useState({
    distance: "8.0",
    etaText: "15-20 min",
    fareLow: 140,
    fareHigh: 180,
  });

  useEffect(() => {
    let cancelled = false;
    const parsedDistance = Number(distanceKm);
    if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      return undefined;
    }

    const timer = setTimeout(async () => {
      setEstimateLoading(true);
      try {
        const estimate = await apiRequest(
          `/rides/estimate?distanceKm=${encodeURIComponent(parsedDistance.toFixed(2))}&rideType=${encodeURIComponent(vehicle)}`
        );
        const fareMin = Number(estimate?.fareMin);
        const fareMax = Number(estimate?.fareMax);
        const etaMin = Number(estimate?.etaMinMinutes);
        const etaMax = Number(estimate?.etaMaxMinutes);
        const apiDistance = Number(estimate?.distanceKm);

        if (!cancelled && Number.isFinite(fareMin) && Number.isFinite(fareMax) && Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
          setEstimatedTrip({
            distance: (Number.isFinite(apiDistance) ? apiDistance : parsedDistance).toFixed(1),
            etaText: `${etaMin}-${etaMax} min`,
            fareLow: Math.round(fareMin),
            fareHigh: Math.round(fareMax),
          });
        }
      } catch {
        // Keep current estimate when backend is unavailable.
      } finally {
        if (!cancelled) {
          setEstimateLoading(false);
        }
      }
    }, 240);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [distanceKm, vehicle]);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) {
      return undefined;
    }

    const reduceMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotionPreference) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll("[data-hero-word]"),
        { opacity: 0, yPercent: 105, rotateX: -70 },
        {
          opacity: 1,
          yPercent: 0,
          rotateX: 0,
          duration: 0.9,
          stagger: 0.045,
          ease: "power3.out",
        }
      );

      gsap.fromTo(
        root.querySelectorAll("[data-float-card]"),
        { opacity: 0, y: 22, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.08,
          delay: 0.18,
          ease: "power2.out",
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  const stats = Array.isArray(copy.highlights) ? copy.highlights.slice(0, 3) : [];
  const steps = Array.isArray(copy.steps) ? copy.steps.slice(0, 3) : [];
  const roles = [
    {
      key: "RIDER",
      title: copy.riderModeTitle || "Rider mode",
      body: copy.riderModeBody || "",
      eyebrow: "Passenger",
    },
    {
      key: "DRIVER",
      title: copy.driverModeTitle || "Driver mode",
      body: copy.driverModeBody || "",
      eyebrow: "Captain",
    },
    {
      key: "ADMIN",
      title: copy.adminModeTitle || "Admin mode",
      body: copy.adminModeBody || "",
      eyebrow: "Control",
    },
  ];

  return (
    <section ref={landingRef} className="landing-home space-y-8 lg:space-y-10">
      <section className="landing-card landing-hero-shell card-rise overflow-hidden" data-reveal>
        <div className="landing-hero-grid grid lg:grid-cols-[1.08fr,0.92fr]">
          <div className="p-6 sm:p-8 lg:p-12" data-scroll data-scroll-speed="-0.25">
            <p className="landing-eyebrow">{copy.badge}</p>
            <h1 className="landing-hero-title mt-4 max-w-2xl text-4xl font-bold leading-[0.95] sm:text-5xl lg:text-6xl">
              <span className="block overflow-hidden">{renderAnimatedWords(copy.heroTitleA)}</span>
              <span className="landing-hero-title__sub mt-3 block overflow-hidden">{renderAnimatedWords(copy.heroTitleB)}</span>
            </h1>
            <p className="landing-body mt-5 max-w-xl text-base leading-7 sm:text-lg">{copy.heroBody}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="btn-primary landing-cta-button landing-cta-button--primary" onClick={() => onOpenAuth("signup", "RIDER")}>
                {copy.heroBookRideCta || "Book a Ride"}
              </button>
              <button className="btn-secondary landing-cta-button" onClick={() => onOpenAuth("signup", "DRIVER")}>
                {copy.heroDriveEarnCta || "Drive & Earn"}
              </button>
              <button className="btn-tertiary landing-cta-button" onClick={() => onOpenAuth("login")}>
                {copy.heroLoginCta || "Login"}
              </button>
            </div>

            <div className="landing-stats mt-10 grid gap-3 sm:grid-cols-3">
              {stats.map((item, index) => (
                <article key={item.label} className="landing-stat-card landing-stat-card--animated" data-float-card style={{ animationDelay: `${index * 0.18}s` }}>
                  <p className="text-2xl font-bold text-slate-50">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.label}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-card-subtle border-t p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-12" data-scroll data-scroll-speed="0.35">
            <div className={`landing-estimator landing-estimator--animated rounded-[1.75rem] p-5 ${estimateLoading ? "loading-shimmer" : ""}`} data-float-card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="landing-eyebrow">{copy.quickEstimatorEyebrow || "Ride estimator"}</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-50">{copy.quickEstimatorTitle || "Quick fare and ETA estimate"}</h2>
                </div>
                {estimateLoading ? <span className="landing-sync-tag">Syncing</span> : null}
              </div>
              <p className="landing-body mt-3 text-sm leading-6">{copy.quickEstimatorBody || "Enter a distance and get an instant estimate."}</p>

              <div className="mt-6 grid gap-3">
                <input
                  type="text"
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  placeholder={copy.quickEstimatorPickupPlaceholder || "e.g. Kharadi, Pune"}
                  className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                />
                <input
                  type="text"
                  value={drop}
                  onChange={(event) => setDrop(event.target.value)}
                  placeholder={copy.quickEstimatorDropPlaceholder || "e.g. Viman Nagar, Pune"}
                  className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,0.95fr]">
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={distanceKm}
                  onChange={(event) => setDistanceKm(event.target.value)}
                  className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                />
                <select
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value)}
                  className="landing-input w-full rounded-2xl px-4 py-3 outline-none"
                >
                  <option value="bike">{copy.quickEstimatorBike || "Bike"}</option>
                  <option value="mini">{copy.quickEstimatorMini || "Mini"}</option>
                  <option value="sedan">{copy.quickEstimatorSedan || "Sedan"}</option>
                </select>
              </div>

              <div className={`landing-estimator__summary landing-estimator__summary--animated mt-6 rounded-[1.5rem] px-5 py-5 text-white ${estimateLoading ? "loading-shimmer" : ""}`}>
                <p className="text-sm text-slate-300">
                  {(pickup.trim() && drop.trim() ? `${pickup.trim()} to ${drop.trim()}` : "Route preview")} • {estimatedTrip.distance} km
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.quickEstimatorEtaLabel || "Estimated arrival"}</p>
                    <p className="mt-2 text-2xl font-bold">{estimatedTrip.etaText}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.quickEstimatorFareLabel || "Estimated fare"}</p>
                    <p className="mt-2 text-2xl font-bold">Rs {estimatedTrip.fareLow}-{estimatedTrip.fareHigh}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]" data-reveal>
        <div className="landing-card landing-section-card p-6 sm:p-8">
          <p className="landing-eyebrow">How it works</p>
          <div className="mt-5 space-y-3">
            {steps.map((step, index) => (
              <article key={step.title} className="signal-step landing-step-card">
                <div className="signal-step__index">0{index + 1}</div>
                <div>
                  <h3 className="text-base font-bold text-slate-50">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-card landing-media-card overflow-hidden">
          <img src={heroImage} alt="RideShare booking preview" className="landing-media-card__image h-64 w-full object-cover sm:h-80" />
          <div className="grid gap-4 border-t border-slate-800/70 p-6 sm:grid-cols-2 sm:p-8">
            <article className="landing-editorial-card landing-editorial-card--animated">
              <p className="landing-eyebrow">{copy.appDemoRideTitle || "Booking and match"}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy.appDemoRideBody || "Pick route, confirm, and get matched with a nearby driver."}</p>
            </article>
            <article className="landing-editorial-card landing-editorial-card--animated">
              <p className="landing-eyebrow">{copy.appDemoSafetyTitle || "Live ride confidence"}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy.appDemoSafetyBody || "Track route and ride status updates in real time."}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-role-grid grid gap-6 lg:grid-cols-3" data-reveal>
        {roles.map((role) => (
            <article key={role.key} className={`landing-card landing-role-card landing-role-card--${role.key.toLowerCase()} landing-role-card--interactive p-6 sm:p-8`}>
            <div className="flex items-center justify-between gap-4">
              <p className="landing-eyebrow">{role.eyebrow}</p>
              <span className="landing-role-chip">{role.key}</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-50">{role.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">{role.body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary landing-cta-button landing-cta-button--primary" onClick={() => onOpenAuth("signup", role.key)}>Create account</button>
              <button className="btn-secondary landing-cta-button" onClick={() => onOpenAuth("login", role.key)}>Login</button>
            </div>
          </article>
        ))}
      </section>

      <section className="landing-map-grid grid gap-6 lg:grid-cols-[1.08fr,0.92fr]" data-reveal>
        <LiveMapPanel
          title={copy.mapTitle}
          defaultCenter={{ lat: 21.774, lon: 78.257 }}
          defaultZoom={6}
          defaultLocationLabel="Multai, India"
          className="landing-map-panel"
          labels={{
            searchPlaceholder: copy.mapSearchPlaceholder,
            useMyLocation: copy.mapUseMyLocation,
            recenter: copy.mapRecenter,
            locateFailed: copy.mapLocateFailed,
            searchFailed: copy.mapSearchFailed,
            indiaOnly: copy.mapIndiaOnly,
            yourLocation: copy.mapYourLocation,
          }}
        />
        <div className="landing-card landing-media-card overflow-hidden">
          <img src={safetyImage} alt="RideShare live tracking preview" className="landing-media-card__image h-64 w-full object-cover" />
          <div className="p-6 sm:p-8">
            <p className="landing-eyebrow">{copy.rolesTitle}</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-50">{copy.safetyTitle}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{copy.safetyBody}</p>
          </div>
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const appRef = useRef(null);
  const hasLoadedRemoteSettingsRef = useRef(false);
  const headerMenuRef = useRef(null);
  const [session, setSession] = useState(getStoredSession);
  const [authMode, setAuthMode] = useState("login");
  const [preferredRole, setPreferredRole] = useState("RIDER");
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [preferences, setPreferences] = useState(getStoredPreferences);
  const [advancedSettings, setAdvancedSettings] = useState(getStoredAdvancedSettings);
  const [panelLocalSettings, setPanelLocalSettings] = useState(getStoredLocalSettings);
  const [activeDashboardPage, setActiveDashboardPage] = useState(() => getDefaultPageForRole(getStoredSession().role));
  const [websiteLanguageOptions, setWebsiteLanguageOptions] = useState(() => [
    ...FALLBACK_TRANSLATION_LANGUAGE_OPTIONS,
  ]);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [userSettingsPrefix, setUserSettingsPrefix] = useState("");

  const currentPage = session.token ? activeDashboardPage : "home";
  const isDriverOpsPage = currentPage === "driver";
  const isAdminPage = currentPage === "admin";
  const isOpsPage = isDriverOpsPage || isAdminPage;
  const resolvedTheme = preferences.theme;
  const dictionary = TRANSLATIONS[preferences.language] || TRANSLATIONS.en;
  const revealKey = `${currentPage}|${showAuth}|${showSettings}|${resolvedTheme}`;
  useRevealItems(appRef, revealKey);
  const translationLanguageOptions = useMemo(() => websiteLanguageOptions, [websiteLanguageOptions]);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
  );
  const settingsSnapshot = useMemo(
    () =>
      buildSettingsDrawerSnapshot({
        session,
        preferences,
        advancedSettings,
        localSettings: panelLocalSettings,
      }),
    [advancedSettings, panelLocalSettings, preferences, session]
  );
  const defaultSettingsSnapshot = useMemo(
    () =>
      buildDefaultSettingsDrawerSnapshot({
        session,
      }),
    [session]
  );

  const syncGoogleLanguageOptions = useCallback(() => {
    const combo = document.querySelector(".goog-te-combo");
    if (!combo) {
      return false;
    }

    const options = Array.from(combo.options)
      .map((option) => ({
        code: String(option.value || "").trim(),
        label: String(option.textContent || "").trim(),
      }))
      .filter(
        (option) =>
          option.code &&
          option.code !== "auto" &&
          option.label &&
          WEBSITE_LANGUAGE_CODES.has(option.code.toLowerCase())
      );

    if (options.length === 0) {
      return false;
    }

    setWebsiteLanguageOptions((previous) => {
      const previousSignature = previous.map((option) => `${option.code}:${option.label}`).join("|");
      const nextSignature = options.map((option) => `${option.code}:${option.label}`).join("|");
      return previousSignature === nextSignature ? previous : options;
    });

    return true;
  }, []);

  const requestUserSettingsApi = useCallback(
    async (method = "GET", body = null) => {
      if (!session.token) {
        throw new Error("Missing auth token.");
      }

      const candidates = userSettingsPrefix
        ? [userSettingsPrefix, ...USER_SETTINGS_PREFIXES.filter((prefix) => prefix !== userSettingsPrefix)]
        : [...USER_SETTINGS_PREFIXES];
      let lastError = null;

      for (const prefix of candidates) {
        try {
          const payload = await apiRequest(prefix, method, body, session.token);
          if (prefix !== userSettingsPrefix) {
            setUserSettingsPrefix(prefix);
          }
          return payload;
        } catch (requestError) {
          lastError = requestError;
          if (!isNotFoundError(requestError)) {
            throw requestError;
          }
        }
      }

      throw lastError || new Error("Unable to sync user settings.");
    },
    [session.token, userSettingsPrefix]
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-scale", `${preferences.fontScale}%`);
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = preferences.language;
    localStorage.setItem("theme", preferences.theme);
    localStorage.setItem("language", preferences.language);
    localStorage.setItem("fontScale", String(preferences.fontScale));
  }, [preferences.fontScale, preferences.language, preferences.theme, resolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.page =
      currentPage === "user"
        ? "rider"
        : currentPage === "driver"
          ? "driver"
          : currentPage === "admin"
            ? "admin"
            : currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!session.token) {
      if (activeDashboardPage !== "home") {
        setActiveDashboardPage("home");
      }
      return;
    }

    if (!isPageAllowedForRole(activeDashboardPage, session.role)) {
      setActiveDashboardPage(getDefaultPageForRole(session.role));
    }
  }, [activeDashboardPage, session.role, session.token]);

  useEffect(() => {
    localStorage.setItem("advancedSettings", JSON.stringify(sanitizeAdvancedSettings(advancedSettings)));
  }, [advancedSettings]);

  useEffect(() => {
    const safeLocalSettings = sanitizeLocalSettings(panelLocalSettings);
    localStorage.setItem("rideshare:settings-drawer", JSON.stringify(safeLocalSettings));
  }, [panelLocalSettings]);

  useEffect(() => {
    const safeLocalSettings = sanitizeLocalSettings(panelLocalSettings);
    const accentPalette = ACCENT_THEMES[safeLocalSettings.appearance.accentTheme] || ACCENT_THEMES.cyan;

    document.documentElement.style.setProperty("--accent", accentPalette.accent);
    document.documentElement.style.setProperty("--accent-strong", accentPalette.accentStrong);
    document.documentElement.style.setProperty("--settings-accent-soft", accentPalette.accentSoft);
    document.documentElement.dataset.compactUi = safeLocalSettings.appearance.compactMode ? "true" : "false";
    document.documentElement.style.setProperty(
      "--settings-motion-scale",
      String(Math.max(0.2, safeLocalSettings.appearance.animationIntensity / 100))
    );
  }, [panelLocalSettings]);

  useEffect(() => {
    if (!session.token) {
      hasLoadedRemoteSettingsRef.current = false;
      setUserSettingsPrefix("");
      return;
    }

    let cancelled = false;
    hasLoadedRemoteSettingsRef.current = false;

    const loadUserSettings = async () => {
      try {
        const payload = await requestUserSettingsApi("GET");
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        setAdvancedSettings((previous) => sanitizeAdvancedSettings({ ...previous, ...payload }));
      } catch {
        if (!cancelled) {
          setSettingsNotice("Settings sync unavailable. Using local values.");
        }
      } finally {
        if (!cancelled) {
          hasLoadedRemoteSettingsRef.current = true;
        }
      }
    };

    loadUserSettings();

    return () => {
      cancelled = true;
    };
  }, [requestUserSettingsApi, session.token]);

  useEffect(() => {
    if (!session.token || !hasLoadedRemoteSettingsRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await requestUserSettingsApi("PUT", sanitizeAdvancedSettings(advancedSettings));
      } catch {
        setSettingsNotice("Failed to save settings to backend.");
      }
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [advancedSettings, requestUserSettingsApi, session.token]);

  useEffect(() => {
    if (!settingsNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSettingsNotice("");
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [settingsNotice]);

  useEffect(() => {
    const host = appRef.current;
    if (!host) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (resolvedTheme !== "dark-theme" || reduceMotion) {
      host.style.removeProperty("--spot-x");
      host.style.removeProperty("--spot-y");
      return undefined;
    }

    let rafId = null;
    const handlePointerMove = (event) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        host.style.setProperty("--spot-x", `${event.clientX}px`);
        host.style.setProperty("--spot-y", `${event.clientY}px`);
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [reduceMotion, resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined" || reduceMotion) {
      return undefined;
    }

    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!pointerQuery.matches) {
      return undefined;
    }

    const magneticNodes = Array.from(document.querySelectorAll("[data-magnetic]"));
    const cleanup = magneticNodes.map((node) => {
      const rawStrength = node.getAttribute("data-magnetic-strength");
      const strength = rawStrength === null || rawStrength === "" ? 20 : Number(rawStrength);
      if (!Number.isFinite(strength) || strength === 0) {
        return () => {};
      }

      let rafId = null;

      const resetTransform = () => {
        node.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
        node.style.transform = "";
      };

      const handleMove = (event) => {
        const rect = node.getBoundingClientRect();
        const offsetX = ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * strength * 2;
        const offsetY = ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * strength * 2;

        if (rafId) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          node.style.transition = "transform 120ms cubic-bezier(0.22, 1, 0.36, 1)";
          node.style.transform = `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) scale(1.01)`;
        });
      };

      const handleLeave = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        resetTransform();
      };

      node.addEventListener("pointermove", handleMove);
      node.addEventListener("pointerleave", handleLeave);
      node.addEventListener("pointerup", handleLeave);

      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        node.removeEventListener("pointermove", handleMove);
        node.removeEventListener("pointerleave", handleLeave);
        node.removeEventListener("pointerup", handleLeave);
        node.style.transform = "";
        node.style.transition = "";
      };
    });

    return () => {
      cleanup.forEach((dispose) => dispose());
    };
  }, [currentPage, showAuth, showHeaderMenu, showSettings, reduceMotion, session.token]);

  useEffect(() => {
    let cancelled = false;
    const preferredLanguage = normalizeLanguageCode(preferences.language);

    const applyLanguage = (languageCode) => {
      const combo = document.querySelector(".goog-te-combo");
      if (!combo) {
        return false;
      }
      syncGoogleLanguageOptions();

      const options = Array.from(combo.options);
      const targetOption =
        options.find((option) => option.value && option.value.toLowerCase() === languageCode.toLowerCase()) ||
        options.find((option) => option.value === "en");

      if (!targetOption) {
        return false;
      }

      if (combo.value !== targetOption.value) {
        combo.value = targetOption.value;
        combo.dispatchEvent(new Event("change"));
      }

      if (targetOption.value !== preferences.language) {
        setPreferences((previous) => ({
          ...previous,
          language: targetOption.value,
        }));
      }

      return true;
    };

    loadGoogleTranslateWidget().then((loaded) => {
      if (!loaded || cancelled) {
        return;
      }

      let attempts = 0;
      const intervalId = setInterval(() => {
        if (cancelled) {
          clearInterval(intervalId);
          return;
        }
        attempts += 1;
        if (applyLanguage(preferredLanguage) || attempts > 24) {
          clearInterval(intervalId);
        }
      }, 150);
    });

    return () => {
      cancelled = true;
    };
  }, [preferences.language, syncGoogleLanguageOptions]);

  useEffect(() => {
    if (!showHeaderMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (headerMenuRef.current?.contains(event.target)) {
        return;
      }
      setShowHeaderMenu(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowHeaderMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showHeaderMenu]);

  useEffect(() => {
    if (showAuth || showSettings) {
      setShowHeaderMenu(false);
    }
  }, [showAuth, showSettings]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setSession(INITIAL_SESSION);
      setPreferredRole(
        session.role === "ADMIN"
          ? "ADMIN"
          : session.role === "DRIVER"
            ? "DRIVER"
            : "RIDER"
      );
      setAuthMode("login");
      setShowAuth(true);
      setShowSettings(false);
      setShowHeaderMenu(false);
      setUserSettingsPrefix("");
      hasLoadedRemoteSettingsRef.current = false;
    };

    window.addEventListener("rideshare:session-expired", handleSessionExpired);
    return () => window.removeEventListener("rideshare:session-expired", handleSessionExpired);
  }, [session.role]);

  const openAuthModal = (mode = "login", role = "RIDER") => {
    setPreferredRole(
      role === "ADMIN"
        ? "ADMIN"
        : role === "DRIVER"
          ? "DRIVER"
          : "RIDER"
    );
    setAuthMode(mode);
    setShowAuth(true);
    setShowHeaderMenu(false);
  };

  const closeAuthModal = () => {
    setShowAuth(false);
  };

  const handleLogin = (data) => {
    const nextSession = {
      token: data?.token || localStorage.getItem("token") || "",
      name: data?.name || localStorage.getItem("name") || "",
      role: (data?.role || localStorage.getItem("role") || "").toUpperCase(),
      userId: String(data?.id || localStorage.getItem("userId") || ""),
      email: data?.email || localStorage.getItem("email") || "",
    };
    setSession(nextSession);
    setActiveDashboardPage(getDefaultPageForRole(nextSession.role));
    setShowAuth(false);
    // Open settings drawer immediately after successful login
    setShowSettings(true);
  };

  const handleSignup = () => {
    setAuthMode("login");
  };

  const handleLogout = () => {
    clearSessionStorage();
    setSession(INITIAL_SESSION);
    setAdvancedSettings({ ...DEFAULT_ADVANCED_SETTINGS });
    setUserSettingsPrefix("");
    hasLoadedRemoteSettingsRef.current = false;
    setShowAuth(false);
    setShowSettings(false);
    setShowHeaderMenu(false);
    setActiveDashboardPage("home");
  };

  const handleBrandClick = () => {
    setShowAuth(false);
    setShowSettings(false);
    setShowHeaderMenu(false);
    setActiveDashboardPage("home");
  };

  const handleSaveSettings = async (drawerSnapshot) => {
    // Split the premium drawer draft into app theme, backend-safe settings, and local-only preferences.
    const nextSnapshot = splitSettingsDrawerSnapshot(drawerSnapshot);

    setPreferences((previous) => ({
      ...previous,
      ...nextSnapshot.preferences,
    }));
    setAdvancedSettings((previous) =>
      sanitizeAdvancedSettings({
        ...previous,
        ...nextSnapshot.advancedSettings,
      })
    );
    setPanelLocalSettings(nextSnapshot.localSettings);
    setSession((previous) => ({
      ...previous,
      name: nextSnapshot.sessionPatch.name,
      email: nextSnapshot.sessionPatch.email,
    }));

    localStorage.setItem("name", nextSnapshot.sessionPatch.name);
    localStorage.setItem("email", nextSnapshot.sessionPatch.email);
    localStorage.setItem("phone", nextSnapshot.sessionPatch.phone);

    setSettingsNotice("Settings saved.");
  };

  const handleDeleteAccountRequest = () => {
    setAdvancedSettings((previous) =>
      sanitizeAdvancedSettings({
        ...previous,
        deleteAccountRequested: true,
      })
    );
    setSettingsNotice("Delete account request marked. Review will follow.");
  };

  const changeLanguage = (event) => {
    setPreferences((previous) => ({
      ...previous,
      language: normalizeLanguageCode(event.target.value),
    }));
  };

  const changeTheme = (nextTheme) => {
    if (!AVAILABLE_THEMES.includes(nextTheme)) {
      return;
    }

    setPreferences((previous) => ({
      ...previous,
      theme: nextTheme,
    }));
  };

  const toggleTheme = () => {
    changeTheme(preferences.theme === "dark-theme" ? "peach-glow" : "dark-theme");
  };

  const isDarkTheme = resolvedTheme === "dark-theme";
  const isOpsDark = isOpsPage && isDarkTheme;
  const themeToggleLabel = isDarkTheme ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div
      className={`${
        isDriverOpsPage
          ? `ops-shell min-h-screen ${
              isDarkTheme
                ? "bg-slate-950 text-slate-100"
                : "bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(236,244,255,0.96))] text-slate-900"
            }`
          : isAdminPage
            ? `ops-shell min-h-screen ${
                isDarkTheme
                  ? "bg-slate-950 text-slate-100"
                  : "bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(236,244,255,0.96))] text-slate-900"
              }`
          : `premium-shell ${isDarkTheme ? "landing-shell" : "landing-shell-light"} mesh-bg min-h-screen ${
              isDarkTheme ? "text-slate-100" : "text-slate-900"
            }`
      }`}
      ref={appRef}
    >
      <div
        id="google_translate_element"
        aria-hidden="true"
        style={{ position: "fixed", left: "-9999px", top: "0", opacity: 0, pointerEvents: "none" }}
      />
      <PremiumCursor />
      <div className="app-shell">
        <header
          className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
            isOpsDark
              ? "border-slate-800/90 bg-slate-950/88"
              : "border-white/70 bg-white/72"
          }`}
          data-reveal="instant"
          data-static-site-header
        >
          <div className={`mx-auto flex w-full items-center justify-between px-4 py-4 sm:px-6 ${isOpsPage ? "max-w-[96rem] xl:px-8" : "max-w-7xl lg:px-10"}`}>
            <button type="button" className="text-left brand-mark" onClick={handleBrandClick}>
              <span className="brand-mark__icon" aria-hidden="true">
                <span className="brand-mark__icon-dot brand-mark__icon-dot--start" />
                <span className="brand-mark__icon-path" />
                <span className="brand-mark__icon-dot brand-mark__icon-dot--end" />
              </span>
              <span className="brand-mark__copy">
                <span className="brand-mark__title">{dictionary.header.product}</span>
                <span className="brand-mark__subtitle">{dictionary.header.subtitle}</span>
              </span>
            </button>
            <div className="header-actions flex items-center gap-3">
              <ThemeToggleSwitch dark={isDarkTheme} onToggle={toggleTheme} label={themeToggleLabel} />

              <div className="relative" ref={headerMenuRef}>
                <button
                  type="button"
                  className="menu-trigger"
                  onClick={() => setShowHeaderMenu((previous) => !previous)}
                  aria-expanded={showHeaderMenu}
                  aria-haspopup="menu"
                  aria-label={showHeaderMenu ? "Close menu" : "Open menu"}
                >
                  <span className="menu-trigger__line" />
                  <span className="menu-trigger__line" />
                  <span className="menu-trigger__line" />
                </button>

                <AnimatePresence>
                  {showHeaderMenu ? (
                    <MotionDiv
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0 }}
                      className="header-menu-panel"
                    >
                      {session.token ? (
                        <>
                          <div className="header-menu__identity">
                            <p className="header-menu__eyebrow">Signed in as</p>
                            <p className="header-menu__user">{session.name || session.role || dictionary.header.user}</p>
                          </div>
                          <div className="header-menu__control">
                            <NotificationCenter token={session.token} />
                          </div>
                        </>
                      ) : null}

                      <label className="header-menu__field">
                        <span className="header-menu__label">{dictionary.settings.language}</span>
                        <select className="header-menu__select" value={preferences.language} onChange={changeLanguage}>
                          {translationLanguageOptions.map((languageOption) => (
                            <option key={languageOption.code} value={languageOption.code}>
                              {languageOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className="header-menu__item"
                        onClick={() => {
                          setShowSettings((previous) => !previous);
                          setShowHeaderMenu(false);
                        }}
                      >
                        {showSettings ? dictionary.header.close : dictionary.header.settings}
                      </button>

                      {session.token ? (
                        <button type="button" className="header-menu__item header-menu__item--danger" onClick={handleLogout}>
                          {dictionary.header.logout}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="header-menu__item header-menu__item--primary"
                          onClick={() => openAuthModal("login")}
                        >
                          {dictionary.header.loginSignup}
                        </button>
                      )}
                    </MotionDiv>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <SettingsDrawer
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          snapshot={settingsSnapshot}
          defaultSnapshot={defaultSettingsSnapshot}
          onSave={handleSaveSettings}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccountRequest}
          notice={settingsNotice}
        />

        <div>
          <main
            className={`mx-auto w-full pb-16 pt-8 ${isOpsPage ? "max-w-none px-0" : "max-w-7xl px-4 sm:px-6 lg:px-10"}`}
            data-reveal="instant"
            data-scroll-section
          >
            <AnimatePresence mode="wait" initial={false}>
              <MotionDiv
                key={currentPage}
                className="page-switch-stage"
                initial={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -12, scale: 0.992 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: PAGE_SWITCH_EASE }}
              >
                {currentPage === "home" && <PremiumLanding onOpenAuth={openAuthModal} copy={dictionary.home} theme={resolvedTheme} />}
                {currentPage === "user" && (
                  <UserDashboard
                    session={session}
                    advancedSettings={advancedSettings}
                  />
                )}
                {currentPage === "driver" && <DriverDashboard />}
                {currentPage === "admin" && <AdminDashboard token={session.token} adminName={session.name} />}
              </MotionDiv>
            </AnimatePresence>
          </main>

          {!isOpsPage ? (
            <footer
              className="border-t border-white/70 bg-white/62 py-5 text-center text-sm text-slate-600 backdrop-blur-xl"
              data-reveal="instant"
              data-scroll-section
            >
              {dictionary.footer.copyright}
            </footer>
          ) : null}
        </div>

        <AnimatePresence>
          {showAuth && !session.token ? (
            <AuthModal
              isOpen={showAuth && !session.token}
              mode={authMode}
              onModeChange={setAuthMode}
              onClose={closeAuthModal}
              onLogin={handleLogin}
              onSignup={handleSignup}
              labels={dictionary.auth}
              productName={dictionary.header.product}
              defaultRole={preferredRole}
              theme={resolvedTheme}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
