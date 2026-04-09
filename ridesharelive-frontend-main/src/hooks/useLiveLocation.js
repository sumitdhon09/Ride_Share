import { useCallback, useMemo, useRef, useState } from "react";

const LOCATION_CACHE_KEY = "rideshare:live-location-label";

function readCachedLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.label !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedLocation(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function resolveReadableLocation(payload) {
  const address = payload?.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.county ||
    address.state_district ||
    address.state ||
    payload?.name ||
    payload?.display_name?.split(",")?.[0] ||
    ""
  );
}

export default function useLiveLocation() {
  const cached = useMemo(() => readCachedLocation(), []);
  const [status, setStatus] = useState(cached?.status || "idle");
  const [label, setLabel] = useState(cached?.label || "Detect Location");
  const [tooltip, setTooltip] = useState("");
  const requestInFlightRef = useRef(null);

  const requestLocation = useCallback(() => {
    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setLabel("Location Unavailable");
      setTooltip("This browser cannot access live location.");
      return Promise.resolve(null);
    }

    const pending = new Promise((resolve) => {
      setStatus("loading");
      setLabel("Detecting...");
      setTooltip("");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(position.coords.latitude)}&lon=${encodeURIComponent(position.coords.longitude)}&zoom=13`
            );
            const payload = await response.json();
            const resolvedArea = resolveReadableLocation(payload);
            const nextLabel = resolvedArea ? `${resolvedArea}` : "Near You";
            setStatus("success");
            setLabel(nextLabel);
            setTooltip("Live location detected from your device.");
            writeCachedLocation({ status: "success", label: nextLabel });
            resolve(payload);
          } catch {
            setStatus("success");
            setLabel("Near You");
            setTooltip("Location detected, address lookup stayed limited.");
            writeCachedLocation({ status: "success", label: "Near You" });
            resolve(null);
          } finally {
            requestInFlightRef.current = null;
          }
        },
        (error) => {
          if (error?.code === 1) {
            setStatus("denied");
            setLabel("Enable Location");
            setTooltip("Allow location access to show your nearby city and better ride context.");
            requestInFlightRef.current = null;
            resolve(null);
            return;
          }

          setStatus("error");
          setLabel("Try Again");
          setTooltip("Location could not be detected right now.");
          requestInFlightRef.current = null;
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
      );
    });

    requestInFlightRef.current = pending;
    return pending;
  }, []);

  return {
    isLoading: status === "loading",
    label,
    requestLocation,
    status,
    tooltip,
  };
}
