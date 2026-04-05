import { startTransition, useCallback, useEffect } from "react";
import { Client } from "@stomp/stompjs";
import { fetchAdminDashboardSections, getWsRefreshConfig, toDashboardWsUrl } from "../services/dashboardService";
import { useDashboardStore } from "../store/dashboardStore";

const DASHBOARD_TOPICS = [
  "/topic/admin/overview",
  "/topic/admin/rides",
  "/topic/admin/safety",
  "/topic/admin/payments",
  "/topic/admin/pricing",
  "/topic/admin/zones",
  "/topic/admin/drivers",
];

function parsePayload(frame) {
  try {
    return JSON.parse(frame.body);
  } catch {
    return null;
  }
}

function deriveAffectedRows(topic, payload) {
  const data = payload?.data || payload || {};
  if (topic === "/topic/admin/rides" && data.rideId) {
    return [{ section: "rides", id: data.rideId }];
  }
  if (topic === "/topic/admin/payments" && data.rideId) {
    return [{ section: "payments", id: data.rideId }];
  }
  if (topic === "/topic/admin/safety") {
    const complaintId = data.id || data.complaintId;
    if (complaintId) {
      return [{ section: "complaints", id: complaintId }];
    }
  }
  if (topic === "/topic/admin/drivers") {
    const driverId = data.driverId || data.id;
    if (driverId) {
      return [{ section: "drivers", id: driverId }];
    }
  }
  return [];
}

export function useWebSocketDashboard(token) {
  const mergeSections = useDashboardStore((state) => state.mergeSections);
  const setLoading = useDashboardStore((state) => state.setLoading);
  const setConnection = useDashboardStore((state) => state.setConnection);
  const showToast = useDashboardStore((state) => state.showToast);
  const flashRows = useDashboardStore((state) => state.flashRows);

  const handleTopicMessage = useCallback(async (topic, payload) => {
    const config = getWsRefreshConfig(topic);
    setLoading(config.keys, true);

    try {
      const { sections, source, errors, generatedAt } = await fetchAdminDashboardSections(token, config.keys);
      startTransition(() => {
        mergeSections(sections, {
          source,
          generatedAt,
          eventType: payload?.type || config.eventType,
          errors,
        });
        flashRows(deriveAffectedRows(topic, payload));
      });
      showToast({
        tone: payload?.type === "SOS_ALERT" ? "warning" : "info",
        message: config.message,
      });
    } finally {
      setLoading(config.keys, false);
    }
  }, [flashRows, mergeSections, setLoading, showToast, token]);

  useEffect(() => {
    if (!token) {
      setConnection({ websocketStatus: "disconnected" });
      return undefined;
    }

    setConnection({ websocketStatus: "connecting" });

    const client = new Client({
      brokerURL: toDashboardWsUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("WebSocket Connected");
        setConnection({ websocketStatus: "connected" });
        DASHBOARD_TOPICS.forEach((topic) => {
          client.subscribe(topic, (frame) => {
            handleTopicMessage(topic, parsePayload(frame));
          });
        });
      },
      onDisconnect: () => {
        console.log("WebSocket Disconnected");
        setConnection({ websocketStatus: "disconnected" });
      },
      onStompError: (frame) => {
        console.error("STOMP Error:", frame.headers["message"]);
        setConnection({ websocketStatus: "error" });
      },
      onWebSocketClose: () => {
        console.log("WebSocket Closed");
        setConnection({ websocketStatus: "connecting" });
      },
      onWebSocketError: (event) => {
        console.error("WebSocket Error:", event);
        setConnection({ websocketStatus: "error" });
      },
    });

    client.activate();
    return () => {
      setConnection({ websocketStatus: "disconnected" });
      client.deactivate();
    };
  }, [handleTopicMessage, setConnection, token]);
}
