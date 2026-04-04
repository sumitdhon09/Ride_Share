import { create } from "zustand";
import { applySimulationEvent, buildFallbackSnapshot } from "../services/dashboardService";

const loadingTemplate = {
  overview: false,
  analytics: false,
  users: false,
  drivers: false,
  rides: false,
  payments: false,
  complaints: false,
  alerts: false,
  settings: false,
  pricing: false,
  liveMap: false,
};

function createInitialState() {
  return {
    data: buildFallbackSnapshot(),
    loadingByKey: { ...loadingTemplate },
    connection: {
      apiStatus: "fallback",
      websocketStatus: "idle",
      pollingActive: false,
      simulationActive: false,
    },
    meta: {
      source: "fallback",
      lastUpdatedAt: new Date().toISOString(),
      lastEventType: "BOOTSTRAP",
      errors: {},
    },
    ui: {
      toast: null,
      highlightedRows: {},
    },
  };
}

function mergeHighlightedRows(previousRows, affectedRows, enabled) {
  if (!Array.isArray(affectedRows) || affectedRows.length === 0) {
    return previousRows;
  }

  const nextRows = { ...previousRows };
  affectedRows.forEach(({ section, id }) => {
    if (!section || id === undefined || id === null) {
      return;
    }
    nextRows[section] = { ...(nextRows[section] || {}), [id]: enabled };
  });
  return nextRows;
}

const highlightTimers = new Map();
let toastTimer = null;

export const useDashboardStore = create((set, get) => ({
  ...createInitialState(),

  reset() {
    set(createInitialState());
  },

  hydrateSnapshot(snapshot, options = {}) {
    set((state) => ({
      data: snapshot || state.data,
      meta: {
        ...state.meta,
        source: options.source || state.meta.source,
        lastUpdatedAt: options.generatedAt || new Date().toISOString(),
        lastEventType: options.eventType || state.meta.lastEventType,
        errors: options.errors || {},
      },
    }));
  },

  mergeSections(sections, options = {}) {
    set((state) => ({
      data: { ...state.data, ...(sections || {}) },
      meta: {
        ...state.meta,
        source: options.source || state.meta.source,
        lastUpdatedAt: options.generatedAt || new Date().toISOString(),
        lastEventType: options.eventType || state.meta.lastEventType,
        errors: options.errors || state.meta.errors,
      },
    }));
  },

  setLoading(keys, value) {
    const requestedKeys = Array.isArray(keys) ? keys : [keys];
    set((state) => ({
      loadingByKey: requestedKeys.reduce(
        (accumulator, key) => ({ ...accumulator, [key]: value }),
        { ...state.loadingByKey }
      ),
    }));
  },

  setConnection(partial) {
    set((state) => ({
      connection: { ...state.connection, ...(partial || {}) },
    }));
  },

  showToast(toast) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }

    set((state) => ({
      ui: {
        ...state.ui,
        toast: {
          id: toast?.id || `${Date.now()}`,
          tone: toast?.tone || "info",
          message: toast?.message || "Dashboard updated",
        },
      },
    }));

    if (typeof window !== "undefined") {
      toastTimer = window.setTimeout(() => {
        set((state) => ({ ui: { ...state.ui, toast: null } }));
        toastTimer = null;
      }, 4200);
    }
  },

  clearToast() {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    set((state) => ({ ui: { ...state.ui, toast: null } }));
  },

  flashRows(affectedRows = [], duration = 2200) {
    set((state) => ({
      ui: {
        ...state.ui,
        highlightedRows: mergeHighlightedRows(state.ui.highlightedRows, affectedRows, true),
      },
    }));

    if (typeof window === "undefined") {
      return;
    }

    affectedRows.forEach(({ section, id }) => {
      if (!section || id === undefined || id === null) {
        return;
      }

      const timerKey = `${section}:${id}`;
      if (highlightTimers.has(timerKey)) {
        window.clearTimeout(highlightTimers.get(timerKey));
      }

      const timer = window.setTimeout(() => {
        set((state) => ({
          ui: {
            ...state.ui,
            highlightedRows: mergeHighlightedRows(state.ui.highlightedRows, [{ section, id }], false),
          },
        }));
        highlightTimers.delete(timerKey);
      }, duration);

      highlightTimers.set(timerKey, timer);
    });
  },

  applySimulation(event) {
    const currentSnapshot = get().data;
    const { snapshot, affected } = applySimulationEvent(currentSnapshot, event);
    set((state) => ({
      data: snapshot,
      meta: {
        ...state.meta,
        source: state.meta.source === "api" ? "hybrid" : state.meta.source,
        lastUpdatedAt: new Date().toISOString(),
        lastEventType: event?.type || "SIMULATION",
      },
      connection: {
        ...state.connection,
        simulationActive: true,
      },
      ui: {
        ...state.ui,
        toast: event?.message
          ? {
              id: event.eventId || `${Date.now()}`,
              message: event.message,
              tone: event.type === "SOS_ALERT" ? "warning" : "info",
            }
          : state.ui.toast,
      },
    }));
    get().flashRows(affected);
  },
}));
