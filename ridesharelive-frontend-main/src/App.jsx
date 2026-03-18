import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import heroImage from "./assets/1.png";
import safetyImage from "./assets/2.png";
import Login from "./Login";
import Signup from "./Signup";
import LiveMapPanel from "./components/LiveMapPanel";
import NotificationCenter from "./components/NotificationCenter";
import ThreeBackdrop from "./components/ThreeBackdrop";
import DriverDashboard from "./pages/DriverDashboard";
import RiderDashboard from "./pages/RiderDashboard";
import { apiRequest } from "./api";

const MotionAside = motion.aside;
const MotionDiv = motion.div;
const PAGE_SWITCH_EASE = [0.22, 1, 0.36, 1];

const INITIAL_SESSION = {
  token: "",
  name: "",
  role: "",
  userId: "",
};

const DEFAULT_PREFERENCES = {
  theme: "urban-transport",
  language: "en",
  fontScale: 100,
};
const AVAILABLE_THEMES = ["urban-transport", "dark-theme"];
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
const VEHICLE_RATES = {
  bike: 12,
  mini: 18,
  sedan: 26,
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
      signupSubtitle: "Create your rider or driver profile",
      switchToSignupPrompt: "Don't have an account?",
      switchToLoginPrompt: "Already have an account?",
      switchToSignupAction: "Sign Up",
      switchToLoginAction: "Login",
      fullName: "Full name",
      email: "Email",
      password: "Password",
      role: "Role",
      rider: "Rider",
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
      riderModeTitle: "Rider mode",
      riderModeBody: "Book quickly, watch real-time status, and review complete trip history.",
      driverModeTitle: "Driver mode",
      driverModeBody: "Accept demand, update ride milestones, and monitor personal earnings.",
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
      rider: "राइडर",
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
      riderModeTitle: "राइडर मोड",
      riderModeBody: "जल्दी बुक करें, लाइव स्टेटस देखें और पूरी राइड हिस्ट्री पाएं।",
      driverModeTitle: "ड्राइवर मोड",
      driverModeBody: "डिमांड एक्सेप्ट करें, स्टेटस अपडेट करें और कमाई ट्रैक करें।",
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
  };
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
}

function HomeLanding({ onOpenAuth, copy }) {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [distanceKm, setDistanceKm] = useState("8");
  const [vehicle, setVehicle] = useState("mini");
  const [estimateLoading, setEstimateLoading] = useState(false);

  const fallbackEstimate = useMemo(() => {
    const parsedDistance = Number(distanceKm);
    const normalizedDistance =
      Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : 1;
    const perKmRate = VEHICLE_RATES[vehicle] || VEHICLE_RATES.mini;
    const baseFare = 35;
    const surgeMultiplier = normalizedDistance > 15 ? 1.12 : 1;
    const estimatedFare = Math.round((baseFare + normalizedDistance * perKmRate) * surgeMultiplier);
    const etaMultiplier = vehicle === "bike" ? 1.1 : vehicle === "sedan" ? 1.45 : 1.3;
    const etaMinutes = Math.round(4 + normalizedDistance * etaMultiplier);

    return {
      distance: normalizedDistance.toFixed(1),
      etaText: `${etaMinutes}-${etaMinutes + 5} min`,
      fareLow: Math.max(estimatedFare - 20, 49),
      fareHigh: estimatedFare + 35,
    };
  }, [distanceKm, vehicle]);
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

  return (
    <section className="space-y-8">
      <div className="landing-stage landing-stage--wide" data-reveal>
        <p className="eyebrow-chip">{copy.badge}</p>
        <div className="hero-billboard mt-7" data-reveal>
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

        <div className="hero-editorial mt-10" data-reveal>
          <h1 className="hero-editorial__title">
            <span>{copy.heroTitleA}</span>
            <span className="hero-editorial__accent">{copy.heroTitleB}</span>
          </h1>
          <p className="hero-editorial__body">{copy.heroBody}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3" data-reveal>
          <button className="btn-primary" onClick={() => onOpenAuth("signup", "RIDER")}>
            {text.heroBookRideCta}
          </button>
          <button className="btn-secondary" onClick={() => onOpenAuth("signup", "DRIVER")}>
            {text.heroDriveEarnCta}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" data-reveal>
          <button className="font-semibold text-slate-700 underline underline-offset-2" onClick={() => onOpenAuth("login")}>
            {text.heroLoginCta}
          </button>
          <span className="text-slate-400">|</span>
          <button className="font-semibold text-slate-700 underline underline-offset-2" onClick={() => onOpenAuth("signup")}>
            {text.heroSignupCta}
          </button>
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
            <p className="route-sculpture__eyebrow">Live dispatch</p>
            <div className="route-sculpture__line">
              <span className="route-sculpture__dot route-sculpture__dot--start" />
              <span className="route-sculpture__trail" />
              <span className="route-sculpture__dot route-sculpture__dot--end" />
            </div>
            <div className="mt-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active route</p>
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
        <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hero signals</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">Fast readouts for riders and drivers</h3>
            <p className="mt-2 text-sm text-slate-600">
              The interface now behaves like an operations board: route state, cost window, and vehicle mode are visible at a glance.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((item) => (
              <article
                key={item.label}
                className="metric-tile rounded-[1.4rem] border border-slate-200/80 bg-white/78 p-4 shadow-sm"
                data-reveal
              >
                <p className="metric-tile__value">{item.value}</p>
                <p className="metric-tile__label">{item.label}</p>
              </article>
            ))}
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

      <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
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
          </div>
        </div>
      </div>

      <div data-reveal>
        <LiveMapPanel
          title={copy.mapTitle}
          defaultCenter={{ lat: 21.774, lon: 78.257 }}
          defaultZoom={6}
          defaultLocationLabel="Multai, India"
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
      </div>
    </section>
  );
}

export default function App() {
  const appRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const locomotiveRef = useRef(null);
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
  const [websiteLanguageOptions, setWebsiteLanguageOptions] = useState(() => [
    ...FALLBACK_TRANSLATION_LANGUAGE_OPTIONS,
  ]);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [userSettingsPrefix, setUserSettingsPrefix] = useState("");

  const currentPage = useMemo(() => {
    if (session.role === "RIDER") {
      return "rider";
    }
    if (session.role === "DRIVER") {
      return "driver";
    }
    return "home";
  }, [session.role]);
  const dictionary = TRANSLATIONS[preferences.language] || TRANSLATIONS.en;
  const revealKey = `${currentPage}|${showAuth}|${showSettings}|${preferences.theme}`;
  useRevealItems(appRef, revealKey);
  const authTitle = authMode === "login" ? dictionary.auth.welcomeBack : dictionary.auth.createAccountHeading;
  const authSubtitle =
    authMode === "login"
      ? dictionary.auth.loginSubtitle || "Enter your credentials"
      : dictionary.auth.signupSubtitle || "Create your rider or driver profile";
  const authSwitchPrompt =
    authMode === "login"
      ? dictionary.auth.switchToSignupPrompt || "Don't have an account?"
      : dictionary.auth.switchToLoginPrompt || "Already have an account?";
  const authSwitchAction =
    authMode === "login"
      ? dictionary.auth.switchToSignupAction || dictionary.auth.signupTab
      : dictionary.auth.switchToLoginAction || dictionary.auth.loginTab;
  const translationLanguageOptions = useMemo(() => websiteLanguageOptions, [websiteLanguageOptions]);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
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
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.language;
    localStorage.setItem("theme", preferences.theme);
    localStorage.setItem("language", preferences.language);
    localStorage.setItem("fontScale", String(preferences.fontScale));
  }, [preferences.fontScale, preferences.language, preferences.theme]);

  useEffect(() => {
    document.documentElement.dataset.page = currentPage;
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem("advancedSettings", JSON.stringify(sanitizeAdvancedSettings(advancedSettings)));
  }, [advancedSettings]);

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
    if (preferences.theme !== "dark-theme" || reduceMotion) {
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
  }, [preferences.theme]);

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
    if (locomotiveRef.current) {
      locomotiveRef.current.destroy();
      locomotiveRef.current = null;
    }
    document.documentElement.classList.remove("has-scroll-init", "has-scroll-smooth", "has-scroll-scrolling");
    document.body.classList.remove("has-scroll-init", "has-scroll-smooth", "has-scroll-scrolling");
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.transform = "";
    }
    return undefined;
  }, [currentPage]);

  useEffect(() => {
    const locomotive = locomotiveRef.current;
    if (!locomotive) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      locomotive.update();
    }, 90);

    return () => window.clearTimeout(timerId);
  }, [currentPage, showAuth, showSettings, preferences.fontScale, preferences.language, session.token]);

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
      setPreferredRole(session.role === "DRIVER" ? "DRIVER" : "RIDER");
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
    setPreferredRole(role === "DRIVER" ? "DRIVER" : "RIDER");
    setAuthMode(mode);
    setShowAuth(true);
    setShowHeaderMenu(false);
  };

  const closeAuthModal = () => {
    setShowAuth(false);
  };

  const handleLogin = (data) => {
    setSession({
      token: data?.token || localStorage.getItem("token") || "",
      name: data?.name || localStorage.getItem("name") || "",
      role: (data?.role || localStorage.getItem("role") || "").toUpperCase(),
      userId: String(data?.id || localStorage.getItem("userId") || ""),
    });
    setShowAuth(false);
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
  };

  const handleBrandClick = () => {
    clearSessionStorage();
    setSession(INITIAL_SESSION);
    setShowAuth(false);
    setShowSettings(false);
    setShowHeaderMenu(false);
    window.location.reload();
  };

  const changeLanguage = (event) => {
    setPreferences((previous) => ({
      ...previous,
      language: normalizeLanguageCode(event.target.value),
    }));
  };

  const toggleDarkTheme = () => {
    setPreferences((previous) => ({
      ...previous,
      theme: previous.theme === "dark-theme" ? "urban-transport" : "dark-theme",
    }));
  };

  const updateAdvancedSetting = (key, value) => {
    setAdvancedSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const isDarkTheme = preferences.theme === "dark-theme";

  return (
    <div className="mesh-bg min-h-screen text-slate-900" ref={appRef}>
      <div
        id="google_translate_element"
        aria-hidden="true"
        style={{ position: "fixed", left: "-9999px", top: "0", opacity: 0, pointerEvents: "none" }}
      />
      {currentPage === "home" ? <ThreeBackdrop theme={preferences.theme} /> : null}
      <div className="app-shell">
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur" data-reveal="instant">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
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
            <div className="header-actions">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleDarkTheme}
                aria-label={isDarkTheme ? "Turn off dark theme" : "Turn on dark theme"}
                title={isDarkTheme ? "Turn off dark theme" : "Turn on dark theme"}
              >
                <span className="theme-toggle__icon" aria-hidden="true">
                  {isDarkTheme ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4.2" />
                      <path d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.2 14.1A8.7 8.7 0 0 1 9.9 3.8a.75.75 0 0 0-.95-.95A9.95 9.95 0 1 0 21.15 15a.75.75 0 0 0-.95-.9Z" />
                    </svg>
                  )}
                </span>
              </button>

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
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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

        <AnimatePresence>
          {showSettings ? (
            <MotionAside
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-4 top-24 z-40 w-[20rem] max-h-[78vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:right-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-600">{dictionary.settings.title}</h2>
              {settingsNotice && (
                <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  {settingsNotice}
                </p>
              )}
              <div className="mt-3 space-y-4">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-800">Map & Navigation</p>
                  <label className="mt-2 block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Map style</span>
                    <select
                      value={advancedSettings.mapStyle}
                      onChange={(event) => updateAdvancedSetting("mapStyle", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="standard">Standard</option>
                      <option value="satellite">Satellite</option>
                      <option value="terrain">Terrain</option>
                    </select>
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>Avoid tolls</span>
                    <input
                      type="checkbox"
                      checked={advancedSettings.avoidTolls}
                      onChange={(event) => updateAdvancedSetting("avoidTolls", event.target.checked)}
                    />
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>Avoid highways</span>
                    <input
                      type="checkbox"
                      checked={advancedSettings.avoidHighways}
                      onChange={(event) => updateAdvancedSetting("avoidHighways", event.target.checked)}
                    />
                  </label>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-800">Ride Preferences</p>
                  <label className="mt-2 block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">Preferred vehicle</span>
                    <select
                      value={advancedSettings.preferredVehicleType}
                      onChange={(event) => updateAdvancedSetting("preferredVehicleType", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="bike">Bike</option>
                      <option value="mini">Mini</option>
                      <option value="sedan">Sedan</option>
                      <option value="auto">Auto</option>
                    </select>
                  </label>
                  <label className="mt-2 block text-sm">
                    <span className="mb-1 block font-semibold text-slate-700">AC preference</span>
                    <select
                      value={advancedSettings.acPreference}
                      onChange={(event) => updateAdvancedSetting("acPreference", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="any">Any</option>
                      <option value="ac">AC only</option>
                      <option value="non-ac">Non-AC</option>
                    </select>
                  </label>
                  <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span>Quiet ride</span>
                    <input
                      type="checkbox"
                      checked={advancedSettings.quietRide}
                      onChange={(event) => updateAdvancedSetting("quietRide", event.target.checked)}
                    />
                  </label>
                </section>
              </div>
            </MotionAside>
          ) : null}
        </AnimatePresence>

        <div ref={scrollContainerRef} data-scroll-container>
          <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10" data-reveal="instant" data-scroll-section>
            <AnimatePresence mode="wait" initial={false}>
              <MotionDiv
                key={currentPage}
                className="page-switch-stage"
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: PAGE_SWITCH_EASE }}
              >
                {currentPage === "home" && <HomeLanding onOpenAuth={openAuthModal} copy={dictionary.home} />}
                {currentPage === "rider" && <RiderDashboard />}
                {currentPage === "driver" && <DriverDashboard />}
              </MotionDiv>
            </AnimatePresence>
          </main>

          <footer
            className="border-t border-slate-200/70 bg-white/75 py-5 text-center text-sm text-slate-600"
            data-reveal="instant"
            data-scroll-section
          >
            {dictionary.footer.copyright}
          </footer>
        </div>

        <AnimatePresence>
          {showAuth && !session.token ? (
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="auth-overlay fixed inset-0 z-50 grid place-items-center px-4 py-6"
            >
              <MotionDiv
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="auth-shell w-full max-w-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="auth-close"
                  aria-label="Close authentication panel"
                >
                  x
                </button>
                <div className="auth-shell__header">
                  <p className="auth-shell__eyebrow">{dictionary.header.product}</p>
                  <h2 className="auth-shell__title">{authTitle}</h2>
                  <p className="auth-shell__subtitle">{authSubtitle}</p>
                </div>
                <div className="auth-shell__form">
                  {authMode === "login" ? (
                    <Login onLogin={handleLogin} labels={dictionary.auth} defaultRole={preferredRole} />
                  ) : (
                    <Signup onSignup={handleSignup} labels={dictionary.auth} defaultRole={preferredRole} />
                  )}
                </div>
                <p className="auth-shell__footer">
                  <span>{authSwitchPrompt}</span>
                  <button
                    type="button"
                    className="auth-shell__footer-action"
                    onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                  >
                    {authSwitchAction}
                  </button>
                </p>
              </MotionDiv>
            </MotionDiv>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
