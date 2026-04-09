import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const MotionDiv = motion.div;
const PAGE_SWITCH_EASE = [0.22, 1, 0.36, 1];

const NotificationCenter = lazy(() => import("../components/NotificationCenter"));
const ThreeBackdrop = lazy(() => import("../components/ThreeBackdrop"));
const DriverDashboard = lazy(() => import("../pages/DriverDashboard"));
const RiderDashboard = lazy(() => import("../pages/RiderDashboard"));

const FALLBACK_TRANSLATION_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
];

const AVAILABLE_THEMES = ["urban-transport", "dark-theme"];

function useGoogleTranslate() {
  const [isTranslateLoaded, setIsTranslateLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadGoogleTranslateWidget = () => {
      if (typeof window === "undefined") {
        return Promise.resolve(false);
      }

      if (window.google?.translate?.TranslateElement) {
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
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
    };

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

function useSessionManager() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem("token");
    return stored ? {
      token: localStorage.getItem("token") || "",
      name: localStorage.getItem("name") || "",
      role: localStorage.getItem("role") || "",
      userId: localStorage.getItem("userId") || "",
    } : {
      token: "",
      name: "",
      role: "",
      userId: "",
    };
  });

  const updateSession = useCallback((newSession) => {
    setSession(newSession);
    if (newSession.token) {
      localStorage.setItem("token", newSession.token);
      localStorage.setItem("name", newSession.name);
      localStorage.setItem("role", newSession.role);
      localStorage.setItem("userId", newSession.userId);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("name");
      localStorage.removeItem("role");
      localStorage.removeItem("userId");
    }
  }, []);

  const clearSession = useCallback(() => {
    updateSession({
      token: "",
      name: "",
      role: "",
      userId: "",
    });
  }, [updateSession]);

  return { session, updateSession, clearSession };
}

function useUserPreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem("userPreferences");
      return stored ? JSON.parse(stored) : {
        theme: "urban-transport",
        language: "en",
        fontScale: 90,
      };
    } catch {
      return {
        theme: "urban-transport",
        language: "en",
        fontScale: 90,
      };
    }
  });

  const updatePreferences = useCallback((newPrefs) => {
    setPreferences(newPrefs);
    localStorage.setItem("userPreferences", JSON.stringify(newPrefs));
  }, []);

  return { preferences, updatePreferences };
}

function DashboardWrapper({ session, clearSession }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notificationsEnabled") !== "false";
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "denied"
  );

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotificationsEnabled(permission === "granted");
      localStorage.setItem("notificationsEnabled", permission === "granted");
      return permission === "granted";
    }
    return false;
  }, []);

  const toggleNotifications = useCallback(() => {
    if (notificationPermission === "default") {
      requestNotificationPermission();
    } else {
      const newState = !notificationsEnabled;
      setNotificationsEnabled(newState);
      localStorage.setItem("notificationsEnabled", newState);
    }
  }, [notificationPermission, notificationsEnabled, requestNotificationPermission]);

  const DashboardComponent = session.role === "DRIVER" ? DriverDashboard : RiderDashboard;

  return (
    <MotionDiv
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: PAGE_SWITCH_EASE }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        <DashboardComponent
          session={session}
          onLogout={clearSession}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={toggleNotifications}
          notificationPermission={notificationPermission}
        />
      </Suspense>

      <AnimatePresence>
        {showNotifications && (
          <MotionDiv
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50"
          >
            <Suspense fallback={<div className="p-4">Loading notifications...</div>}>
              <NotificationCenter
                onClose={() => setShowNotifications(false)}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={toggleNotifications}
                notificationPermission={notificationPermission}
              />
            </Suspense>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

export {
  useGoogleTranslate,
  useSessionManager,
  useUserPreferences,
  DashboardWrapper,
  AVAILABLE_THEMES,
  FALLBACK_TRANSLATION_LANGUAGE_OPTIONS,
};
