import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { AnimatePresence, motion } from "motion/react";
import Velocity from "velocity-animate";
import { API_BASE_URL, apiRequest } from "../api";

const NOTIFICATION_PREFIXES = ["/notifications", "/api/notifications"];
const OPEN_EASING = [0.22, 1, 0.36, 1];
const CLOSE_EASING = [0.4, 0, 1, 1];
const WS_BASE = (import.meta.env.VITE_WS_BASE_URL || API_BASE_URL).trim().replace(/\/+$/, "");
const WS_BROKER_URL = `${WS_BASE.replace(/^http/i, "ws")}/ws`;
const MotionDiv = motion.div;

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("404") || message.includes("not found");
}

function buildLocalDummyNotifications() {
  const now = Date.now();
  return [
    {
      id: "demo-1",
      title: "Welcome to RideShare Live",
      message: "Your account is ready. Explore rides and features.",
      createdAt: new Date(now - 50 * 60 * 1000).toISOString(),
      read: false,
      status: "DELIVERED",
    },
    {
      id: "demo-2",
      title: "Promo unlocked",
      message: "Use code FIRST50 to save on your next trip.",
      createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
      read: false,
      status: "DELIVERED",
    },
    {
      id: "demo-3",
      title: "Safety reminder",
      message: "Share your live trip with a trusted contact.",
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
      read: true,
      status: "READ",
    },
  ];
}

export default function NotificationCenter({ token = "" }) {
  const [open, setOpen] = useState(false);
  const [renderPanel, setRenderPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [endpointPrefix, setEndpointPrefix] = useState("");
  const [liveToast, setLiveToast] = useState(null);
  const [pulseUnreadBadge, setPulseUnreadBadge] = useState(false);
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);
  const previousUnreadRef = useRef(0);
  const hasUnreadSnapshotRef = useRef(false);
  const toastTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const openRef = useRef(open);
  const stompClientRef = useRef(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const closePanel = useCallback(() => {
    const panelNode = panelRef.current;
    setOpen(false);
    if (!panelNode) {
      setRenderPanel(false);
      return;
    }

    Velocity(panelNode, "stop", true);
    Velocity(
      panelNode,
      { opacity: 0, translateY: -10, scale: 0.98 },
      {
        duration: 170,
        easing: CLOSE_EASING,
        complete: () => {
          if (!openRef.current) {
            setRenderPanel(false);
          }
        },
      }
    );
  }, []);

  const openPanel = useCallback(() => {
    setRenderPanel(true);
    setOpen(true);
  }, []);

  const triggerLiveFeedback = useCallback((message) => {
    if (!message) {
      return;
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }

    setLiveToast({
      id: Date.now(),
      message,
    });

    setPulseUnreadBadge(false);
    requestAnimationFrame(() => setPulseUnreadBadge(true));

    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 2400);
    pulseTimerRef.current = setTimeout(() => {
      setPulseUnreadBadge(false);
    }, 760);
  }, []);

  const requestNotificationApi = useCallback(
    async (suffix, method = "GET", body = null) => {
      const candidates = endpointPrefix
        ? [endpointPrefix, ...NOTIFICATION_PREFIXES.filter((prefix) => prefix !== endpointPrefix)]
        : [...NOTIFICATION_PREFIXES];
      let lastError = null;

      for (const prefix of candidates) {
        try {
          const payload = await apiRequest(`${prefix}${suffix}`, method, body, token);
          if (prefix !== endpointPrefix) {
            setEndpointPrefix(prefix);
          }
          return payload;
        } catch (requestError) {
          lastError = requestError;
          if (!isNotFoundError(requestError)) {
            throw requestError;
          }
        }
      }

      throw lastError || new Error("Unable to fetch notifications.");
    },
    [endpointPrefix, token]
  );

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      setEndpointPrefix("");
      return;
    }

    setLoading(true);
    try {
      const response = await requestNotificationApi("/history", "GET", null);
      const items = Array.isArray(response?.items) ? response.items : [];
      const unread = Number(response?.unreadCount) || 0;
      setNotifications(items);
      setUnreadCount(unread);
      setError("");
    } catch (requestError) {
      if (isNotFoundError(requestError)) {
        const demoItems = buildLocalDummyNotifications();
        setNotifications(demoItems);
        setUnreadCount(demoItems.filter((item) => !item.read).length);
        setError("");
        return;
      }
      setError(requestError.message || "Unable to fetch notifications.");
    } finally {
      setLoading(false);
    }
  }, [requestNotificationApi, token]);

  const handleSocketPayload = useCallback((payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.type === "NOTIFICATION_CREATED" && payload.notification) {
      setNotifications((previous) => {
        const nextItems = [payload.notification, ...previous];
        const deduped = [];
        const seen = new Set();
        for (const item of nextItems) {
          const key = String(item?.id ?? "");
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          deduped.push(item);
        }
        return deduped;
      });
      setUnreadCount(Number(payload.unreadCount) || 0);
      setError("");
      return;
    }

    if (payload.type === "NOTIFICATION_SYNC") {
      setNotifications(Array.isArray(payload.items) ? payload.items : []);
      setUnreadCount(Number(payload.unreadCount) || 0);
      setError("");
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 45000);
    return () => clearInterval(intervalId);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!token) {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      return undefined;
    }

    let client = null;
    client = new Client({
      brokerURL: WS_BROKER_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });

    client.onConnect = () => {
      setError("");
      client.subscribe("/user/queue/notifications", (frame) => {
        try {
          handleSocketPayload(JSON.parse(frame.body));
        } catch {
          // Ignore malformed socket payloads and keep REST fallback active.
        }
      });
    };

    client.onWebSocketError = () => {
      // Keep the REST fallback active; avoid noisy UI for transient socket issues.
    };

    client.onStompError = () => {
      // Keep the REST fallback active; avoid replacing the current data with an error state.
    };

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (client) {
        client.deactivate();
      }
      if (stompClientRef.current === client) {
        stompClientRef.current = null;
      }
    };
  }, [handleSocketPayload, token]);

  useEffect(() => {
    if (!renderPanel || !open) {
      return;
    }

    const panelNode = panelRef.current;
    if (!panelNode) {
      return;
    }

    Velocity(panelNode, "stop", true);
    Velocity(
      panelNode,
      { opacity: [1, 0], translateY: [0, -12], scale: [1, 0.97] },
      { duration: 250, easing: OPEN_EASING }
    );
  }, [open, renderPanel]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!open || !containerRef.current || containerRef.current.contains(event.target)) {
        return;
      }
      closePanel();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closePanel, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closePanel, open]);

  useEffect(() => {
    if (token) {
      return;
    }
    setOpen(false);
    setRenderPanel(false);
  }, [token]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const buttonNode = triggerRef.current;
    if (!buttonNode) {
      previousUnreadRef.current = unreadCount;
      return;
    }

    if (!hasUnreadSnapshotRef.current) {
      hasUnreadSnapshotRef.current = true;
      previousUnreadRef.current = unreadCount;
      return;
    }

    if (unreadCount > previousUnreadRef.current) {
      Velocity(buttonNode, "stop", true);
      Velocity(
        buttonNode,
        { scale: [1.08, 1] },
        {
          duration: 180,
          easing: OPEN_EASING,
        }
      );
      Velocity(
        buttonNode,
        { scale: 1 },
        {
          duration: 170,
          easing: CLOSE_EASING,
        }
      );
      triggerLiveFeedback("New notification received.");
    }

    previousUnreadRef.current = unreadCount;
  }, [triggerLiveFeedback, unreadCount]);

  useEffect(() => {
    if (!open || !renderPanel) {
      return;
    }
    const cards = listRef.current?.querySelectorAll("[data-notification-card='1']");
    if (!cards || cards.length === 0) {
      return;
    }
    Velocity(cards, "stop", true);
    Velocity(
      cards,
      { opacity: [1, 0], translateY: [0, 8] },
      { duration: 240, easing: OPEN_EASING, stagger: 45 }
    );
  }, [notifications, open, renderPanel]);

  const markRead = async (notificationId) => {
    if (!token) {
      return;
    }
    if (String(notificationId).startsWith("demo-")) {
      setNotifications((previous) =>
        previous.map((item) => (item.id === notificationId ? { ...item, read: true, status: "READ" } : item))
      );
      setUnreadCount((previous) => Math.max(0, previous - 1));
      return;
    }
    try {
      await requestNotificationApi(`/mark-read/${notificationId}`, "POST", null);
      setNotifications((previous) =>
        previous.map((item) => (item.id === notificationId ? { ...item, read: true, status: "READ" } : item))
      );
      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch {
      // Ignore UI errors for individual mark-read actions.
    }
  };

  const markAllRead = async () => {
    if (!token) {
      return;
    }
    const onlyDemoItems = notifications.length > 0 && notifications.every((item) => String(item.id).startsWith("demo-"));
    if (onlyDemoItems) {
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true, status: "READ" })));
      setUnreadCount(0);
      return;
    }
    try {
      await requestNotificationApi("/mark-all-read", "POST", null);
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true, status: "READ" })));
      setUnreadCount(0);
    } catch {
      // Ignore transient errors; user can retry.
    }
  };

  const sendTestNotification = async () => {
    if (!token || sendingTest) {
      return;
    }

    setSendingTest(true);
    try {
      await requestNotificationApi("/test", "POST", null);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to send test notification.");
    } finally {
      setSendingTest(false);
    }
  };

  const buttonLabel = useMemo(() => "Notifications", []);

  if (!token) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="btn-secondary notification-trigger"
        ref={triggerRef}
        onClick={() => {
          if (open) {
            closePanel();
            return;
          }
          openPanel();
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span>{buttonLabel}</span>
        {unreadCount > 0 ? (
          <span className={`notification-count-badge ${pulseUnreadBadge ? "pulse-once" : ""}`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {liveToast?.message ? (
          <MotionDiv
            key={liveToast.id}
            initial={{ opacity: 0, y: 8, x: 8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -4, x: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="notification-live-toast"
          >
            {liveToast.message}
          </MotionDiv>
        ) : null}
      </AnimatePresence>
      {renderPanel && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 z-50 w-[22rem] max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-3 opacity-0 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={sendTestNotification}
                disabled={sendingTest}
              >
                {sendingTest ? "Sending..." : "Send test"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            </div>
          </div>
          {loading && <p className="mt-2 text-xs text-slate-500">Loading...</p>}
          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">{error}</p>
          )}
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" ref={listRef} data-notification-list="1">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  data-notification-card="1"
                  className={`rounded-xl border p-2 ${
                    notification.read
                      ? "border-slate-200 bg-slate-50"
                      : "border-cyan-200 bg-cyan-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{notification.title || "Notification"}</p>
                      <p className="mt-1 text-xs text-slate-700">{notification.message || ""}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatTime(notification.createdAt)}</p>
                    </div>
                    {!notification.read && (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => markRead(notification.id)}
                      >
                        Read
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
