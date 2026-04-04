import { useEffect } from "react";
import { createSimulationEvent } from "../services/dashboardService";
import { useDashboardStore } from "../store/dashboardStore";

export function useLiveDashboardSimulation(enabled, intervalMs = 9000) {
  const applySimulation = useDashboardStore((state) => state.applySimulation);
  const setConnection = useDashboardStore((state) => state.setConnection);

  useEffect(() => {
    if (!enabled) {
      setConnection({ simulationActive: false });
      return undefined;
    }

    setConnection({ simulationActive: true });

    const tick = () => {
      const snapshot = useDashboardStore.getState().data;
      const event = createSimulationEvent(snapshot);
      applySimulation(event);
    };

    const intervalId = window.setInterval(tick, intervalMs);
    return () => {
      window.clearInterval(intervalId);
      setConnection({ simulationActive: false });
    };
  }, [applySimulation, enabled, intervalMs, setConnection]);
}
