export const SETTINGS_LOCAL_STORAGE_KEY = "rideshare:settings-drawer";

export const ACCENT_THEMES = {
  cyan: {
    id: "cyan",
    label: "Cyan",
    accent: "#22d3ee",
    accentStrong: "#0ea5e9",
    accentSoft: "rgba(34, 211, 238, 0.18)",
  },
  blue: {
    id: "blue",
    label: "Blue",
    accent: "#60a5fa",
    accentStrong: "#2563eb",
    accentSoft: "rgba(96, 165, 250, 0.18)",
  },
  purple: {
    id: "purple",
    label: "Purple",
    accent: "#a78bfa",
    accentStrong: "#7c3aed",
    accentSoft: "rgba(167, 139, 250, 0.18)",
  },
};

const DEFAULT_REFUND_HISTORY = [
  { id: "refund-1", label: "Airport cancellation", amount: 120, status: "Processed" },
  { id: "refund-2", label: "Promo adjustment", amount: 80, status: "Credited" },
];

export const DEFAULT_LOCAL_SETTINGS = {
  profilePhone: "+91 98765 43210",
  savedAddresses: ["Home · Kharadi", "Work · Hinjewadi", "Airport · Lohegaon"],
  notificationSettings: {
    rideUpdates: true,
    driverArrived: true,
    paymentAlerts: true,
    fareDrop: false,
    promoOffers: true,
    emailSummaries: true,
  },
  safetySettings: {
    trustedContacts: ["Aditi · +91 98765 22110", "Rahul · +91 99876 44550"],
    otpVerification: true,
    nightSafetyMode: true,
  },
  rideSettings: {
    femaleDriverPreference: false,
    petFriendly: false,
  },
  paymentSettings: {
    walletBalance: 640,
    promoCoupon: "",
    refundHistory: DEFAULT_REFUND_HISTORY,
  },
  appearance: {
    accentTheme: "cyan",
    compactMode: false,
    animationIntensity: 78,
  },
};

export const DEFAULT_DRAWER_SNAPSHOT = {
  profile: {
    fullName: "Passenger",
    phone: DEFAULT_LOCAL_SETTINGS.profilePhone,
    email: "passenger@rideshare.live",
    savedAddresses: [...DEFAULT_LOCAL_SETTINGS.savedAddresses],
  },
  ridePreferences: {
    preferredRideType: "mini",
    silentRideMode: false,
    femaleDriverPreference: false,
    acRideDefault: false,
    petFriendly: false,
  },
  notifications: { ...DEFAULT_LOCAL_SETTINGS.notificationSettings },
  safety: {
    trustedContacts: [...DEFAULT_LOCAL_SETTINGS.safetySettings.trustedContacts],
    liveTripSharing: true,
    otpVerification: true,
    nightSafetyMode: true,
  },
  payments: {
    defaultPaymentMethod: "UPI",
    walletBalance: DEFAULT_LOCAL_SETTINGS.paymentSettings.walletBalance,
    invoices: true,
    promoCoupon: "",
    refundHistory: [...DEFAULT_LOCAL_SETTINGS.paymentSettings.refundHistory],
  },
  appearance: {
    theme: "dark-theme",
    accentTheme: DEFAULT_LOCAL_SETTINGS.appearance.accentTheme,
    compactMode: DEFAULT_LOCAL_SETTINGS.appearance.compactMode,
    animationIntensity: DEFAULT_LOCAL_SETTINGS.appearance.animationIntensity,
    mapStyle: "standard",
  },
  meta: {
    role: "RIDER",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const next = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  return next.length > 0 ? next : [...fallback];
}

function sanitizeBooleanRecord(value, fallback) {
  const next = { ...fallback };
  if (!value || typeof value !== "object") {
    return next;
  }
  Object.keys(fallback).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      next[key] = Boolean(value[key]);
    }
  });
  return next;
}

function sanitizeRefundHistory(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return clone(DEFAULT_REFUND_HISTORY);
  }
  return value
    .map((item, index) => ({
      id: String(item?.id || `refund-${index + 1}`),
      label: String(item?.label || "Ride refund").trim() || "Ride refund",
      amount: Number(item?.amount) || 0,
      status: String(item?.status || "Processed").trim() || "Processed",
    }))
    .slice(0, 6);
}

export function sanitizeLocalSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  return {
    profilePhone: String(source.profilePhone || DEFAULT_LOCAL_SETTINGS.profilePhone).trim() || DEFAULT_LOCAL_SETTINGS.profilePhone,
    savedAddresses: sanitizeStringArray(source.savedAddresses, DEFAULT_LOCAL_SETTINGS.savedAddresses),
    notificationSettings: sanitizeBooleanRecord(source.notificationSettings, DEFAULT_LOCAL_SETTINGS.notificationSettings),
    safetySettings: {
      trustedContacts: sanitizeStringArray(
        source.safetySettings?.trustedContacts,
        DEFAULT_LOCAL_SETTINGS.safetySettings.trustedContacts
      ),
      otpVerification:
        typeof source.safetySettings?.otpVerification === "boolean"
          ? source.safetySettings.otpVerification
          : DEFAULT_LOCAL_SETTINGS.safetySettings.otpVerification,
      nightSafetyMode:
        typeof source.safetySettings?.nightSafetyMode === "boolean"
          ? source.safetySettings.nightSafetyMode
          : DEFAULT_LOCAL_SETTINGS.safetySettings.nightSafetyMode,
    },
    rideSettings: {
      femaleDriverPreference:
        typeof source.rideSettings?.femaleDriverPreference === "boolean"
          ? source.rideSettings.femaleDriverPreference
          : DEFAULT_LOCAL_SETTINGS.rideSettings.femaleDriverPreference,
      petFriendly:
        typeof source.rideSettings?.petFriendly === "boolean"
          ? source.rideSettings.petFriendly
          : DEFAULT_LOCAL_SETTINGS.rideSettings.petFriendly,
    },
    paymentSettings: {
      walletBalance:
        Number.isFinite(Number(source.paymentSettings?.walletBalance))
          ? Number(source.paymentSettings.walletBalance)
          : DEFAULT_LOCAL_SETTINGS.paymentSettings.walletBalance,
      promoCoupon: String(source.paymentSettings?.promoCoupon || "").trim(),
      refundHistory: sanitizeRefundHistory(source.paymentSettings?.refundHistory),
    },
    appearance: {
      accentTheme: ACCENT_THEMES[source.appearance?.accentTheme] ? source.appearance.accentTheme : DEFAULT_LOCAL_SETTINGS.appearance.accentTheme,
      compactMode:
        typeof source.appearance?.compactMode === "boolean"
          ? source.appearance.compactMode
          : DEFAULT_LOCAL_SETTINGS.appearance.compactMode,
      animationIntensity: Math.max(
        0,
        Math.min(
          100,
          Number.isFinite(Number(source.appearance?.animationIntensity))
            ? Number(source.appearance.animationIntensity)
            : DEFAULT_LOCAL_SETTINGS.appearance.animationIntensity
        )
      ),
    },
  };
}

export function getStoredLocalSettings() {
  if (typeof window === "undefined") {
    return sanitizeLocalSettings(DEFAULT_LOCAL_SETTINGS);
  }

  const raw = window.localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
  if (!raw) {
    return sanitizeLocalSettings(DEFAULT_LOCAL_SETTINGS);
  }

  try {
    return sanitizeLocalSettings(JSON.parse(raw));
  } catch {
    return sanitizeLocalSettings(DEFAULT_LOCAL_SETTINGS);
  }
}

export function buildSettingsDrawerSnapshot({ session, preferences, advancedSettings, localSettings }) {
  const safeLocalSettings = sanitizeLocalSettings(localSettings);
  const safeSession = session && typeof session === "object" ? session : {};
  const safePreferences = preferences && typeof preferences === "object" ? preferences : {};
  const safeAdvancedSettings = advancedSettings && typeof advancedSettings === "object" ? advancedSettings : {};
  const storedName =
    typeof window !== "undefined" ? String(window.localStorage.getItem("name") || "").trim() : "";
  const storedEmail =
    typeof window !== "undefined" ? String(window.localStorage.getItem("email") || "").trim() : "";

  return {
    profile: {
      fullName: String(safeSession.name || storedName || "Passenger").trim() || "Passenger",
      phone: safeLocalSettings.profilePhone,
      email: String(safeSession.email || storedEmail || "passenger@rideshare.live").trim() || "passenger@rideshare.live",
      savedAddresses: [...safeLocalSettings.savedAddresses],
    },
    ridePreferences: {
      preferredRideType: String(safeAdvancedSettings.preferredVehicleType || "mini"),
      silentRideMode: Boolean(safeAdvancedSettings.quietRide),
      femaleDriverPreference: Boolean(safeLocalSettings.rideSettings.femaleDriverPreference),
      acRideDefault: String(safeAdvancedSettings.acPreference || "").toLowerCase() === "ac",
      petFriendly: Boolean(safeLocalSettings.rideSettings.petFriendly),
    },
    notifications: { ...safeLocalSettings.notificationSettings },
    safety: {
      trustedContacts: [...safeLocalSettings.safetySettings.trustedContacts],
      liveTripSharing: Boolean(safeAdvancedSettings.tripSharingDefault ?? true),
      otpVerification: Boolean(safeLocalSettings.safetySettings.otpVerification),
      nightSafetyMode: Boolean(safeLocalSettings.safetySettings.nightSafetyMode),
    },
    payments: {
      defaultPaymentMethod: String(safeAdvancedSettings.defaultPaymentMethod || "upi").toUpperCase(),
      walletBalance: Number(safeLocalSettings.paymentSettings.walletBalance) || 0,
      invoices: Boolean(safeAdvancedSettings.invoiceEmailEnabled ?? true),
      promoCoupon: safeLocalSettings.paymentSettings.promoCoupon,
      refundHistory: clone(safeLocalSettings.paymentSettings.refundHistory),
    },
    appearance: {
      theme: String(safePreferences.theme || "dark-theme"),
      accentTheme: safeLocalSettings.appearance.accentTheme,
      compactMode: Boolean(safeLocalSettings.appearance.compactMode),
      animationIntensity: Number(safeLocalSettings.appearance.animationIntensity) || 0,
      mapStyle: String(safeAdvancedSettings.mapStyle || "standard"),
    },
    meta: {
      role: String(safeSession.role || "RIDER").toUpperCase() || "RIDER",
    },
  };
}

export function buildDefaultSettingsDrawerSnapshot({ session }) {
  return buildSettingsDrawerSnapshot({
    session,
    preferences: { theme: "dark-theme" },
    advancedSettings: {
      preferredVehicleType: "mini",
      quietRide: false,
      acPreference: "any",
      tripSharingDefault: true,
      defaultPaymentMethod: "upi",
      invoiceEmailEnabled: true,
      mapStyle: "standard",
    },
    localSettings: DEFAULT_LOCAL_SETTINGS,
  });
}

export function splitSettingsDrawerSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : DEFAULT_DRAWER_SNAPSHOT;
  const safeLocalSettings = sanitizeLocalSettings({
    profilePhone: source.profile?.phone,
    savedAddresses: source.profile?.savedAddresses,
    notificationSettings: source.notifications,
    safetySettings: {
      trustedContacts: source.safety?.trustedContacts,
      otpVerification: source.safety?.otpVerification,
      nightSafetyMode: source.safety?.nightSafetyMode,
    },
    rideSettings: {
      femaleDriverPreference: source.ridePreferences?.femaleDriverPreference,
      petFriendly: source.ridePreferences?.petFriendly,
    },
    paymentSettings: {
      walletBalance: source.payments?.walletBalance,
      promoCoupon: source.payments?.promoCoupon,
      refundHistory: source.payments?.refundHistory,
    },
    appearance: {
      accentTheme: source.appearance?.accentTheme,
      compactMode: source.appearance?.compactMode,
      animationIntensity: source.appearance?.animationIntensity,
    },
  });

  return {
    preferences: {
      theme: source.appearance?.theme === "peach-glow" ? "peach-glow" : "dark-theme",
    },
    advancedSettings: {
      preferredVehicleType: String(source.ridePreferences?.preferredRideType || "mini"),
      quietRide: Boolean(source.ridePreferences?.silentRideMode),
      acPreference: source.ridePreferences?.acRideDefault ? "ac" : "any",
      tripSharingDefault: Boolean(source.safety?.liveTripSharing),
      defaultPaymentMethod: String(source.payments?.defaultPaymentMethod || "UPI").toLowerCase(),
      invoiceEmailEnabled: Boolean(source.payments?.invoices),
      mapStyle: String(source.appearance?.mapStyle || "standard"),
    },
    localSettings: safeLocalSettings,
    sessionPatch: {
      name: String(source.profile?.fullName || "Passenger").trim() || "Passenger",
      email: String(source.profile?.email || "passenger@rideshare.live").trim() || "passenger@rideshare.live",
      phone: safeLocalSettings.profilePhone,
    },
  };
}
