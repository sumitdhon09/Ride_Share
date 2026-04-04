import { startTransition, useEffect, useRef } from "react";
import { fetchAdminDashboardSections } from "../services/dashboardService";
import { useDashboardStore } from "../store/dashboardStore";

const POLL_KEYS = ["overview", "analytics", "drivers", "rides", "payments", "complaints", "alerts", "liveMap"];

export function usePollingFallback(token, enabled, intervalMs = 5000) {
  const mergeSections = useDashboardStore((state) => state.mergeSections);
  const setConnection = useDashboardStore((state) => state.setConnection);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setConnection({ pollingActive: false });
      return undefined;
    }

    setConnection({ pollingActive: true });

    const poll = async () => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const { sections, source, errors, generatedAt } = await fetchAdminDashboardSections(token, POLL_KEYS);
        startTransition(() => {
          mergeSections(sections, {
            source,
            generatedAt,
            eventType: "POLL_REFRESH",
            errors,
          });
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    poll();
    const intervalId = window.setInterval(poll, intervalMs);

    return () => {
      window.clearInterval(intervalId);
      setConnection({ pollingActive: false });
      inFlightRef.current = false;
    };
  }, [enabled, intervalMs, mergeSections, setConnection, token]);
}
