import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import heroImage from "../assets/1.png";
import safetyImage from "../assets/2.png";
import Login from "../Login";
import Signup from "../Signup";
import LiveMapPanel from "../components/LiveMapPanel";
import { apiRequest } from "../api";

const MotionAside = motion.aside;
const MotionDiv = motion.div;
const MotionButton = motion.button;
const PAGE_SWITCH_EASE = [0.22, 1, 0.36, 1];
const AUTH_STATE_TRANSITION = {
  initial: { opacity: 0, y: 10, scale: 0.985, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, scale: 0.975, filter: "blur(8px)" },
  transition: { duration: 0.28, ease: PAGE_SWITCH_EASE },
};
const AUTH_ACTION_INTERACTION = {
  whileHover: { y: -1, scale: 1.02 },
  whileTap: { y: 0, scale: 0.97 },
  transition: { type: "spring", stiffness: 420, damping: 28 },
};

const INITIAL_SESSION = {
  token: "",
  name: "",
  role: "",
  userId: "",
};

const DEFAULT_PREFERENCES = {
  theme: "urban-transport",
  language: "en",
  fontScale: 90,
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

function buildSessionFromAuthPayload(data) {
  return {
    token: String(data?.accessToken || data?.token || localStorage.getItem("token") || ""),
    name: String(data?.name || localStorage.getItem("name") || ""),
    role: String(data?.role || localStorage.getItem("role") || "").toUpperCase(),
    userId: String(data?.id || data?.userId || localStorage.getItem("userId") || ""),
  };
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
    const existingScript = document.querySelector("script[src*='translate.google.com']");
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.translate?.TranslateElement) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5000);
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => {
      console.error("Failed to load Google Translate widget");
      resolve(false);
    };

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: FALLBACK_TRANSLATION_LANGUAGE_OPTIONS.map((opt) => opt.code).join(","),
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          "google_translate_element"
        );
        resolve(true);
      } else {
        resolve(false);
      }
    };

    document.head.appendChild(script);
  });

  return googleTranslateLoaderPromise;
}

function useGoogleTranslate() {
  const [isTranslateLoaded, setIsTranslateLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadGoogleTranslateWidget().then((loaded) => {
      if (mounted) {
        setIsTranslateLoaded(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return isTranslateLoaded;
}

function AuthPanel({ currentPage, setCurrentPage, onAuthSuccess }) {
  return (
    <MotionAside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: PAGE_SWITCH_EASE }}
      className="w-full lg:w-1/2 p-4 lg:p-8 flex flex-col justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 order-2 lg:order-1 min-h-[50vh] lg:min-h-screen"
    >
      <div className="w-full max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentPage === "login" ? (
            <motion.div key="login" {...AUTH_STATE_TRANSITION}>
              <Login onLoginSuccess={onAuthSuccess} onSwitchToSignup={() => setCurrentPage("signup")} />
            </motion.div>
          ) : (
            <motion.div key="signup" {...AUTH_STATE_TRANSITION}>
              <Signup onSignupSuccess={onAuthSuccess} onSwitchToLogin={() => setCurrentPage("login")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionAside>
  );
}

function HeroSection({ setCurrentPage }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: PAGE_SWITCH_EASE }}
      className="w-full lg:w-1/2 p-4 lg:p-8 flex flex-col justify-center items-center text-center order-1 lg:order-2 min-h-[50vh] lg:min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 dark:from-blue-800 dark:via-purple-800 dark:to-pink-800"
    >
      <div className="w-full max-w-lg space-y-6">
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="space-y-2"
        >
          <h1 className="text-4xl lg:text-6xl font-bold text-white drop-shadow-lg">
            RideShare Live
          </h1>
          <p className="text-lg lg:text-xl text-blue-100 drop-shadow">
            Real-time ride sharing at your fingertips
          </p>
        </MotionDiv>

        <div className="relative w-full h-48 lg:h-64 rounded-xl overflow-hidden shadow-2xl">
          <img
            src={heroImage}
            alt="Ride sharing app preview"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-4"
        >
          <p className="text-white text-sm lg:text-base drop-shadow">
            Join thousands of riders and drivers enjoying seamless, affordable transportation
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <MotionButton
              {...AUTH_ACTION_INTERACTION}
              onClick={() => setCurrentPage("login")}
              className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Sign In
            </MotionButton>
            <MotionButton
              {...AUTH_ACTION_INTERACTION}
              onClick={() => setCurrentPage("signup")}
              variant="outline"
              className="px-6 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors shadow-lg"
            >
              Register
            </MotionButton>
          </div>
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}

export { AuthPanel, HeroSection, buildSessionFromAuthPayload, INITIAL_SESSION, DEFAULT_PREFERENCES, DEFAULT_ADVANCED_SETTINGS, VEHICLE_RATES };
