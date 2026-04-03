import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Client } from "@stomp/stompjs";
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import { apiRequest, API_BASE_URL } from "../api.jsx";
import AdminHeader from "../components/AdminHeader";
import AdminSidebar from "../components/AdminSidebar";
import AlertPanel from "../components/AlertPanel";
import ComplaintsTable from "../components/ComplaintsTable";
import DriverApprovalTable from "../components/DriverApprovalTable";
import LiveRideMapCard from "../components/LiveRideMapCard";
import LiveUpdateToast from "../components/LiveUpdateToast";
import OverviewStatCard from "../components/OverviewStatCard";
import PaymentSummaryCard from "../components/PaymentSummaryCard";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard" },
  { id: "riders", label: "Riders", path: "/riders" },
  { id: "drivers", label: "Drivers", path: "/drivers" },
  { id: "rides", label: "Rides", path: "/rides" },
  { id: "payments", label: "Payments", path: "/payments" },
  { id: "approvals", label: "Approvals", path: "/approvals" },
  { id: "complaints", label: "Complaints", path: "/complaints" },
  { id: "analytics", label: "Analytics", path: "/analytics" },
  { id: "settings", label: "Settings", path: "/settings" },
];

const ADMIN_ROUTE_STORAGE_KEY = "rideshare:admin-route";
const VALID_ADMIN_PATHS = new Set(["/"].concat(NAV_ITEMS.map((item) => item.path)));

const SETTINGS_LABELS = {
  "pricing.surgeCap": "Surge cap",
  "pricing.nightCharge": "Night charge",
  "routing.ruralRate": "Rural route rate",
  "mail.smtpHost": "SMTP host",
  "maintenance.enabled": "Maintenance mode",
};

function themeFlag() {
  return document.documentElement.dataset.theme === "dark-theme";
}

function toWsUrl() {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}/ws`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function saveCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(
      rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Modal({ open, title, children, onClose, isDark }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-2xl rounded-[1.75rem] border p-5 shadow-2xl ${isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button type="button" onClick={onClose} className={`rounded-full border px-3 py-1 text-sm ${isDark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"}`}>
                Close
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SectionCard({ title, eyebrow, children, isDark, actions }) {
  return (
    <section className={`rounded-[1.75rem] border p-5 ${isDark ? "border-slate-800 bg-slate-950/92" : "border-slate-200 bg-white/96"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {eyebrow ? <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{eyebrow}</p> : null}
          <h3 className={`mt-2 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataTable({ columns, rows, isDark, emptyLabel = "No data", loading = false, rowActions }) {
  return (
    <div className={`overflow-hidden rounded-[1.2rem] border ${isDark ? "border-slate-800" : "border-slate-200"}`}>
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y text-sm ${isDark ? "divide-slate-800" : "divide-slate-200"}`}>
          <thead className={isDark ? "bg-slate-900/80 text-left text-slate-400" : "bg-slate-50 text-left text-slate-500"}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>
              ))}
              {rowActions ? <th className="px-4 py-3 font-medium">Actions</th> : null}
            </tr>
          </thead>
          <tbody className={isDark ? "divide-y divide-slate-800 text-slate-200" : "divide-y divide-slate-200 text-slate-700"}>
            {loading ? (
              [...Array.from({ length: 4 })].map((_, index) => (
                <tr key={`loading-${index}`}>
                  <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-4">
                    <div className={`loading-shimmer h-10 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-100"}`} />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id ?? row.key} className={isDark ? "hover:bg-slate-900/70" : "hover:bg-slate-50"}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
                {rowActions ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">{rowActions(row)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCard({ title, data, children, isDark }) {
  return (
    <SectionCard title={title} eyebrow="Analytics" isDark={isDark}>
      <div className="h-72">{children(data)}</div>
    </SectionCard>
  );
}

function useAdminOpsData(token) {
  const [data, setData] = useState({
    overview: null,
    analytics: null,
    users: { items: [], total: 0 },
    drivers: { items: [], total: 0 },
    rides: { items: [], total: 0 },
    payments: { items: [], total: 0 },
    complaints: { items: [], total: 0 },
    alerts: { items: [], total: 0 },
    settings: { items: [], updatedAt: "" },
    pricing: { items: [], updatedAt: "" },
    liveMap: null,
  });
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);

  const run = async (key, task, options = {}) => {
    setLoading((previous) => ({ ...previous, [key]: true }));
    try {
      const result = await task();
      setData((previous) => ({ ...previous, [key]: result }));
      if (options.toast) {
        setToast({ id: `${Date.now()}`, message: options.toast, tone: "success" });
      }
      return result;
    } catch (error) {
      if (!options.silent) {
        setToast({ id: `${Date.now()}`, message: error.message || "Request failed", tone: "warning" });
      }
      throw error;
    } finally {
      setLoading((previous) => ({ ...previous, [key]: false }));
    }
  };

  const refreshOverview = () => run("overview", () => apiRequest("/api/admin/overview", "GET", null, token), { silent: true });
  const refreshAnalytics = () => run("analytics", () => apiRequest("/api/admin/analytics", "GET", null, token), { silent: true });
  const refreshUsers = () => run("users", () => apiRequest("/api/admin/users", "GET", null, token), { silent: true });
  const refreshDrivers = () => run("drivers", () => apiRequest("/api/admin/drivers", "GET", null, token), { silent: true });
  const refreshRides = () => run("rides", () => apiRequest("/api/admin/rides", "GET", null, token), { silent: true });
  const refreshPayments = () => run("payments", () => apiRequest("/api/admin/payments", "GET", null, token), { silent: true });
  const refreshComplaints = () => run("complaints", () => apiRequest("/api/admin/complaints", "GET", null, token), { silent: true });
  const refreshAlerts = () => run("alerts", () => apiRequest("/api/admin/alerts", "GET", null, token), { silent: true });
  const refreshSettings = () => run("settings", () => apiRequest("/api/admin/settings", "GET", null, token), { silent: true });
  const refreshPricing = () => run("pricing", () => apiRequest("/api/admin/pricing", "GET", null, token), { silent: true });
  const refreshLiveMap = () => run("liveMap", () => apiRequest("/api/admin/live-map", "GET", null, token), { silent: true });

  const refreshAll = async () => {
    await Promise.allSettled([
      refreshOverview(),
      refreshAnalytics(),
      refreshUsers(),
      refreshDrivers(),
      refreshRides(),
      refreshPayments(),
      refreshComplaints(),
      refreshAlerts(),
      refreshSettings(),
      refreshPricing(),
      refreshLiveMap(),
    ]);
  };

  useEffect(() => {
    if (!token) return;
    refreshAll();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const client = new Client({
      brokerURL: toWsUrl(),
      reconnectDelay: 4000,
      onConnect: () => {
        [
          ["/topic/admin/overview", refreshOverview, "Overview updated"],
          ["/topic/admin/rides", async () => Promise.allSettled([refreshRides(), refreshOverview(), refreshLiveMap()]), "Ride operations updated"],
          ["/topic/admin/safety", async () => Promise.allSettled([refreshAlerts(), refreshComplaints(), refreshOverview()]), "Safety queue updated"],
          ["/topic/admin/payments", async () => Promise.allSettled([refreshPayments(), refreshOverview()]), "Payments updated"],
          ["/topic/admin/pricing", async () => Promise.allSettled([refreshPricing(), refreshSettings()]), "Pricing updated"],
          ["/topic/admin/zones", async () => Promise.allSettled([refreshLiveMap(), refreshOverview()]), "Zone map updated"],
        ].forEach(([topic, handler, message]) => {
          client.subscribe(topic, () => {
            handler();
            setToast({ id: `${Date.now()}-${topic}`, message, tone: "info" });
          });
        });
      },
    });
    client.activate();
    return () => client.deactivate();
  }, [token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    data,
    loading,
    toast,
    actions: {
      approveDriver: async (row) => {
        setData((previous) => ({
          ...previous,
          drivers: { ...previous.drivers, items: previous.drivers.items.map((item) => (item.id === row.id ? { ...item, kycStatus: "APPROVED" } : item)) },
        }));
        await apiRequest(`/api/admin/drivers/${row.id}/approve`, "POST", null, token);
        await Promise.allSettled([refreshDrivers(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: `${row.name} approved`, tone: "success" });
      },
      rejectDriver: async (row) => {
        setData((previous) => ({
          ...previous,
          drivers: { ...previous.drivers, items: previous.drivers.items.map((item) => (item.id === row.id ? { ...item, kycStatus: "REJECTED" } : item)) },
        }));
        await apiRequest(`/api/admin/drivers/${row.id}/reject`, "POST", null, token);
        await Promise.allSettled([refreshDrivers(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: `${row.name} rejected`, tone: "warning" });
      },
      acknowledgeAlert: async (alert, status = "ACKNOWLEDGED") => {
        setData((previous) => ({
          ...previous,
          alerts: { ...previous.alerts, items: previous.alerts.items.filter((item) => item.id !== alert.id) },
        }));
        await apiRequest(`/api/admin/alerts/${encodeURIComponent(alert.id)}/acknowledge`, "PATCH", { status }, token);
        await Promise.allSettled([refreshAlerts(), refreshOverview(), refreshComplaints()]);
        setToast({ id: `${Date.now()}`, message: `${alert.title} ${status.toLowerCase()}`, tone: "success" });
      },
      complaintAction: async (row, action, note = "") => {
        await apiRequest(`/api/admin/complaints/${row.id}`, "PATCH", { action, note }, token);
        await Promise.allSettled([refreshComplaints(), refreshAlerts(), refreshOverview(), refreshPayments()]);
        setToast({ id: `${Date.now()}`, message: `${row.subject} updated`, tone: "success" });
      },
      rideAction: async (row, action) => {
        await apiRequest(`/api/admin/rides/${row.id}`, "PATCH", { action }, token);
        await Promise.allSettled([refreshRides(), refreshOverview(), refreshLiveMap(), refreshPayments()]);
        setToast({ id: `${Date.now()}`, message: `Ride #${row.id} updated`, tone: "success" });
      },
      paymentAction: async (row, action) => {
        await apiRequest(`/api/admin/payments/${row.rideId}`, "POST", { action }, token);
        await Promise.allSettled([refreshPayments(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: `Payment ${action.toLowerCase().replace("_", " ")}`, tone: "success" });
      },
      userAction: async (row, action) => {
        await apiRequest(`/api/admin/users/${row.id}`, "PATCH", { action }, token);
        await Promise.allSettled([refreshUsers(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: `${row.name} updated`, tone: "success" });
      },
      saveSettings: async (items) => {
        await apiRequest("/api/admin/settings", "PUT", { items }, token);
        await Promise.allSettled([refreshSettings(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: "Settings saved", tone: "success" });
      },
      savePricing: async (items) => {
        await apiRequest("/api/admin/pricing", "PUT", { items }, token);
        await Promise.allSettled([refreshPricing(), refreshOverview()]);
        setToast({ id: `${Date.now()}`, message: "Pricing updated", tone: "success" });
      },
    },
  };
}

function AdminWorkspace({ token, adminName }) {
  const [isDark, setIsDark] = useState(themeFlag);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const [dateRange, setDateRange] = useState("Today");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [kycModal, setKycModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [pricingDraft, setPricingDraft] = useState({});
  const { data, loading, toast, actions } = useAdminOpsData(token);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(themeFlag());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nextPath = VALID_ADMIN_PATHS.has(location.pathname) ? location.pathname : "/dashboard";
    localStorage.setItem(ADMIN_ROUTE_STORAGE_KEY, nextPath);
  }, [location.pathname]);

  useEffect(() => {
    setSettingsDraft(Object.fromEntries((data.settings.items || []).map((item) => [item.key, item.value || ""])));
  }, [data.settings.items]);

  useEffect(() => {
    setPricingDraft(
      Object.fromEntries((data.pricing.items || []).map((item) => [
        item.rideType,
        {
          rideType: item.rideType,
          baseFare: item.baseFare,
          perKmRate: item.perKmRate,
          perMinuteRate: item.perMinuteRate,
          ruralMultiplier: item.ruralMultiplier,
          cityTierMultiplier: item.cityTierMultiplier,
          nightChargeMultiplier: item.nightChargeMultiplier,
          peakMultiplier: item.peakMultiplier,
          maxSurgeMultiplier: item.maxSurgeMultiplier,
          tollFee: item.tollFee,
          bookingFee: item.bookingFee,
        },
      ]))
    );
  }, [data.pricing.items]);

  const activeConfig = NAV_ITEMS.find((item) => location.pathname.includes(item.id)) || NAV_ITEMS[0];
  const filteredUsers = useMemo(
    () => (data.users.items || []).filter((row) => !deferredSearch || `${row.name} ${row.email} ${row.city}`.toLowerCase().includes(deferredSearch)),
    [data.users.items, deferredSearch]
  );
  const filteredDrivers = useMemo(
    () => (data.drivers.items || []).filter((row) => !deferredSearch || `${row.name} ${row.email} ${row.city} ${row.assignedZone}`.toLowerCase().includes(deferredSearch)),
    [data.drivers.items, deferredSearch]
  );
  const filteredRides = useMemo(
    () => (data.rides.items || []).filter((row) => !deferredSearch || `${row.id} ${row.riderName} ${row.driverName} ${row.pickup} ${row.destination}`.toLowerCase().includes(deferredSearch)),
    [data.rides.items, deferredSearch]
  );
  const filteredPayments = useMemo(
    () => (data.payments.items || []).filter((row) => !deferredSearch || `${row.rideId} ${row.riderName} ${row.driverName} ${row.paymentMode} ${row.paymentStatus}`.toLowerCase().includes(deferredSearch)),
    [data.payments.items, deferredSearch]
  );
  const filteredComplaints = useMemo(
    () => (data.complaints.items || []).map((row) => ({ ...row, owner: `${row.userName} / ${row.driverName}`, severity: row.severity || "MEDIUM" }))
      .filter((row) => !deferredSearch || `${row.subject} ${row.owner} ${row.city}`.toLowerCase().includes(deferredSearch)),
    [data.complaints.items, deferredSearch]
  );
  const pendingApprovals = useMemo(
    () => filteredDrivers.filter((row) => ["PENDING", "REJECTED"].includes(String(row.kycStatus || "").toUpperCase())),
    [filteredDrivers]
  );
  const paymentMetrics = useMemo(() => {
    const payments = data.payments.items || [];
    const totalAmount = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const failed = payments.filter((row) => String(row.paymentStatus).toUpperCase().includes("FAIL")).length;
    const refunded = payments.filter((row) => String(row.paymentStatus).toUpperCase().includes("REFUND")).length;
    const settled = payments.filter((row) => row.settlementStatus === "SETTLED").length;
    return [
      ["Revenue tracked", formatCurrency(totalAmount)],
      ["Failed payments", String(failed)],
      ["Refund queue", String(refunded)],
      ["Settled payouts", String(settled)],
    ];
  }, [data.payments.items]);

  const navItems = NAV_ITEMS.map((item) => {
    if (item.id === "drivers") return { ...item, badge: String(data.overview?.kpis?.activeDrivers || 0) };
    if (item.id === "approvals") return { ...item, badge: String(pendingApprovals.length) };
    if (item.id === "complaints") return { ...item, badge: String(data.overview?.kpis?.pendingComplaints || 0) };
    return item;
  });

  const exportCurrentView = () => {
    if (activeConfig.id === "riders") saveCsv("riders.csv", filteredUsers);
    else if (activeConfig.id === "drivers" || activeConfig.id === "approvals") saveCsv("drivers.csv", filteredDrivers);
    else if (activeConfig.id === "rides") saveCsv("rides.csv", filteredRides);
    else if (activeConfig.id === "payments") saveCsv("payments.csv", filteredPayments);
    else if (activeConfig.id === "complaints") saveCsv("complaints.csv", filteredComplaints);
    else if (activeConfig.id === "settings") saveCsv("settings.csv", data.settings.items || []);
    else saveCsv("overview-alerts.csv", data.alerts.items || []);
  };

  const breadcrumbMap = {
    dashboard: ["Admin", "Dashboard"],
    riders: ["Admin", "Users", "Riders"],
    drivers: ["Admin", "Drivers"],
    rides: ["Admin", "Rides"],
    payments: ["Admin", "Payments"],
    approvals: ["Admin", "Approvals"],
    complaints: ["Admin", "Complaints"],
    analytics: ["Admin", "Analytics"],
    settings: ["Admin", "Settings"],
  };

  const overviewCards = useMemo(() => {
    const kpis = data.overview?.kpis || {};
    const revenueTrend = (data.analytics?.dailyRevenue || []).map((point) => point.value);
    const ridesTrend = (data.analytics?.ridesByHour || []).map((point) => point.value);
    const driverTrend = (data.analytics?.driverOnlineTrend || []).map((point) => point.value);
    const completionTrend = (data.analytics?.cancellationTrend || []).map((point) => point.value);
    return [
      { label: "Total riders", value: kpis.totalUsers || 0, tone: "default", delta: 6.2, sparkline: ridesTrend },
      { label: "Total drivers", value: kpis.totalDrivers || 0, tone: "cyan", delta: 3.8, sparkline: driverTrend },
      { label: "Ongoing rides", value: kpis.ongoingRides || 0, tone: "green", delta: 4.4, sparkline: ridesTrend },
      { label: "Completed today", value: kpis.completedToday || 0, tone: "green", delta: 5.1, sparkline: ridesTrend },
      { label: "Revenue today", value: Number(kpis.revenueToday || 0), tone: "green", delta: 8.9, sparkline: revenueTrend, formatter: (value) => formatCurrency(value), suffix: "" },
      { label: "Cancelled %", value: Number(kpis.cancelledPercentage || 0), tone: "rose", delta: -1.6, sparkline: completionTrend, formatter: (value) => Number(value).toFixed(1), suffix: "%" },
      { label: "Pending complaints", value: kpis.pendingComplaints || 0, tone: "amber", delta: 2.4, sparkline: completionTrend },
      { label: "Live alerts", value: data.alerts.total || 0, tone: "rose", delta: 1.1, sparkline: completionTrend },
    ];
  }, [data.overview, data.analytics, data.alerts.total]);

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card, index) => (
          <OverviewStatCard key={card.label} {...card} delay={index * 0.04} isDark={isDark} />
        ))}
      </div>
      {!alertsOnly ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Rides by hour" data={data.analytics?.ridesByHour || []} isDark={isDark}>
              {(chartData) => (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="ridesGlow" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                    <XAxis dataKey="label" stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="url(#ridesGlow)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Daily revenue" data={data.analytics?.dailyRevenue || []} isDark={isDark}>
              {(chartData) => (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                    <XAxis dataKey="label" stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="grid gap-5">
            <LiveRideMapCard mapData={data.liveMap} isDark={isDark} />
            <PaymentSummaryCard metrics={paymentMetrics} isDark={isDark} />
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <DriverApprovalTable
          rows={pendingApprovals.slice(0, 6)}
          onApprove={actions.approveDriver}
          onReject={actions.rejectDriver}
          onViewKyc={setKycModal}
          isDark={isDark}
          loading={loading.drivers}
        />
        <AlertPanel
          alerts={data.alerts.items || []}
          onOpen={setAlertModal}
          onAcknowledge={(alert) => actions.acknowledgeAlert(alert, "ACKNOWLEDGED")}
          onResolve={(alert) => actions.acknowledgeAlert(alert, "RESOLVED")}
          onEscalate={(alert) => actions.acknowledgeAlert(alert, "ESCALATED")}
          isDark={isDark}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ComplaintsTable
          rows={filteredComplaints.slice(0, 5)}
          onResolve={(row) => actions.complaintAction(row, "RESOLVE")}
          onEscalate={(row) => actions.complaintAction(row, "ESCALATE")}
          onAssign={(row) => actions.complaintAction(row, "ASSIGN_SUPPORT_TICKET", "ops-auto")}
          isDark={isDark}
          loading={loading.complaints}
        />
        <SectionCard title="Operations activity" eyebrow="Timeline" isDark={isDark}>
          <div className="space-y-3">
            {(data.overview?.liveAlerts || []).map((item) => (
              <div key={item.id} className={`rounded-[1.2rem] border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.title}</p>
                  <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const renderRiders = () => (
    <SectionCard title="Rider management" eyebrow="Users" isDark={isDark}>
      <DataTable
        columns={[
          { key: "name", label: "Rider", render: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></div> },
          { key: "city", label: "City" },
          { key: "walletBalance", label: "Wallet", render: (row) => formatCurrency(row.walletBalance) },
          { key: "complaintsCount", label: "Complaints" },
          { key: "totalTrips", label: "Trips" },
          { key: "totalSpending", label: "Spending", render: (row) => formatCurrency(row.totalSpending) },
        ]}
        rows={filteredUsers}
        isDark={isDark}
        loading={loading.users}
        rowActions={(row) => (
          <>
            <button type="button" onClick={() => actions.userAction(row, "VIEW")} className={`rounded-full border px-3 py-1 text-[11px] ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>View</button>
            <button type="button" onClick={() => actions.userAction(row, "REFUND")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">Refund</button>
            <button type="button" onClick={() => actions.userAction(row, row.blocked ? "ACTIVATE" : "SUSPEND")} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200">{row.blocked ? "Activate" : "Suspend"}</button>
          </>
        )}
      />
    </SectionCard>
  );

  const renderDrivers = () => (
    <SectionCard title="Driver fleet" eyebrow="Drivers" isDark={isDark}>
      <DataTable
        columns={[
          { key: "name", label: "Driver", render: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></div> },
          { key: "city", label: "City" },
          { key: "kycStatus", label: "KYC" },
          { key: "assignedZone", label: "Zone" },
          { key: "acceptancePercentage", label: "Accept %", render: (row) => formatPercent(row.acceptancePercentage) },
          { key: "earningsToday", label: "Today", render: (row) => formatCurrency(row.earningsToday) },
        ]}
        rows={filteredDrivers}
        isDark={isDark}
        loading={loading.drivers}
        rowActions={(row) => (
          <>
            <button type="button" onClick={() => setKycModal(row)} className={`rounded-full border px-3 py-1 text-[11px] ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>KYC</button>
            <button type="button" onClick={() => actions.approveDriver(row)} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">Approve</button>
            <button type="button" onClick={() => actions.rejectDriver(row)} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200">Reject</button>
          </>
        )}
      />
    </SectionCard>
  );

  const renderRides = () => (
    <SectionCard title="Live ride management" eyebrow="Rides" isDark={isDark}>
      <DataTable
        columns={[
          { key: "id", label: "Ride" },
          { key: "riderName", label: "Rider" },
          { key: "driverName", label: "Driver" },
          { key: "pickup", label: "Pickup" },
          { key: "destination", label: "Drop" },
          { key: "fare", label: "Fare", render: (row) => formatCurrency(row.fare) },
          { key: "status", label: "Status" },
          { key: "etaLabel", label: "ETA" },
        ]}
        rows={filteredRides}
        isDark={isDark}
        loading={loading.rides}
        rowActions={(row) => (
          <>
            <button type="button" onClick={() => actions.rideAction(row, "TRACK_LIVE")} className={`rounded-full border px-3 py-1 text-[11px] ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>Track</button>
            <button type="button" onClick={() => actions.rideAction(row, "MANUAL_COMPLETE")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">Complete</button>
            <button type="button" onClick={() => actions.rideAction(row, "CANCEL_RIDE")} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200">Cancel</button>
          </>
        )}
      />
    </SectionCard>
  );

  const renderPayments = () => (
    <div className="space-y-5">
      <PaymentSummaryCard metrics={paymentMetrics} isDark={isDark} />
      <SectionCard title="Transactions and settlements" eyebrow="Payments" isDark={isDark}>
        <DataTable
          columns={[
            { key: "rideId", label: "Ride" },
            { key: "riderName", label: "Rider" },
            { key: "driverName", label: "Driver" },
            { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
            { key: "paymentMode", label: "Mode" },
            { key: "paymentStatus", label: "Status" },
            { key: "settlementStatus", label: "Settlement" },
          ]}
          rows={filteredPayments}
          isDark={isDark}
          loading={loading.payments}
          rowActions={(row) => (
            <>
              <button type="button" onClick={() => actions.paymentAction(row, "RETRY_FAILED")} className={`rounded-full border px-3 py-1 text-[11px] ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>Retry</button>
              <button type="button" onClick={() => actions.paymentAction(row, "MANUAL_REFUND")} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">Refund</button>
              <button type="button" onClick={() => actions.paymentAction(row, "SETTLEMENT_LOG")} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">Settle</button>
            </>
          )}
        />
      </SectionCard>
    </div>
  );

  const renderApprovals = () => (
    <DriverApprovalTable
      rows={pendingApprovals}
      onApprove={actions.approveDriver}
      onReject={actions.rejectDriver}
      onViewKyc={setKycModal}
      isDark={isDark}
      loading={loading.drivers}
    />
  );

  const renderComplaints = () => (
    <ComplaintsTable
      rows={filteredComplaints}
      onResolve={(row) => actions.complaintAction(row, "RESOLVE")}
      onEscalate={(row) => actions.complaintAction(row, "ESCALATE")}
      onAssign={(row) => actions.complaintAction(row, "ASSIGN_SUPPORT_TICKET", `${adminName || "admin"} assigned`)}
      isDark={isDark}
      loading={loading.complaints}
    />
  );

  const renderAnalytics = () => (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Daily revenue" data={data.analytics?.dailyRevenue || []} isDark={isDark}>
        {(chartData) => (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
              <XAxis dataKey="label" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#0f766e33" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      <ChartCard title="Cancellation trend" data={data.analytics?.cancellationTrend || []} isDark={isDark}>
        {(chartData) => (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
              <XAxis dataKey="label" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      <ChartCard title="Driver online trend" data={data.analytics?.driverOnlineTrend || []} isDark={isDark}>
        {(chartData) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
              <XAxis dataKey="label" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip />
              <Bar dataKey="value" fill="#34d399" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      <ChartCard title="City demand heatmap" data={data.analytics?.cityDemand || []} isDark={isDark}>
        {(chartData) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
              <XAxis dataKey="zoneName" stroke={isDark ? "#94a3b8" : "#64748b"} />
              <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
              <Tooltip />
              <Bar dataKey="ongoingRides" fill="#38bdf8" radius={[8, 8, 0, 0]} />
              <Bar dataKey="activeDrivers" fill="#fbbf24" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );

  const renderSettings = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <SectionCard
        title="Platform settings"
        eyebrow="Config"
        isDark={isDark}
        actions={
          <button
            type="button"
            onClick={() => actions.saveSettings(Object.entries(settingsDraft).map(([key, value]) => ({ key, value, category: key.split(".")[0] })))}
            className="rounded-[1rem] border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200"
          >
            Save settings
          </button>
        }
      >
        <div className="grid gap-3">
          {(data.settings.items || []).map((item) => (
            <label key={item.key} className="grid gap-2">
              <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>{SETTINGS_LABELS[item.key] || item.key}</span>
              <input
                value={settingsDraft[item.key] ?? ""}
                onChange={(event) => setSettingsDraft((previous) => ({ ...previous, [item.key]: event.target.value }))}
                className={`rounded-[1rem] border px-3 py-3 text-sm ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"}`}
              />
            </label>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="Dynamic pricing"
        eyebrow="Pricing"
        isDark={isDark}
        actions={
          <button
            type="button"
            onClick={() => actions.savePricing(Object.values(pricingDraft).map((item) => ({
              ...item,
              baseFare: Number(item.baseFare),
              perKmRate: Number(item.perKmRate),
              perMinuteRate: Number(item.perMinuteRate),
              ruralMultiplier: Number(item.ruralMultiplier),
              cityTierMultiplier: Number(item.cityTierMultiplier),
              nightChargeMultiplier: Number(item.nightChargeMultiplier),
              peakMultiplier: Number(item.peakMultiplier),
              maxSurgeMultiplier: Number(item.maxSurgeMultiplier),
              tollFee: Number(item.tollFee),
              bookingFee: Number(item.bookingFee),
            })))}
            className="rounded-[1rem] border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200"
          >
            Save pricing
          </button>
        }
      >
        <div className="space-y-4">
          {(data.pricing.items || []).map((item) => (
            <div key={item.rideType} className={`rounded-[1.2rem] border p-4 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}>
              <p className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.rideType}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {["baseFare", "perKmRate", "perMinuteRate", "ruralMultiplier", "nightChargeMultiplier", "maxSurgeMultiplier"].map((field) => (
                  <label key={field} className="grid gap-1">
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{field}</span>
                    <input
                      value={pricingDraft[item.rideType]?.[field] ?? ""}
                      onChange={(event) => setPricingDraft((previous) => ({
                        ...previous,
                        [item.rideType]: { ...previous[item.rideType], [field]: event.target.value },
                      }))}
                      className={`rounded-[0.95rem] border px-3 py-2 text-sm ${isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  return (
    <section className={isDark ? "min-h-screen bg-[linear-gradient(180deg,#020617_0%,#06111f_100%)] text-slate-100" : "min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900"}>
      <LiveUpdateToast toast={toast} />
      <div className="mx-auto max-w-[96rem] space-y-6 px-4 pb-8 sm:px-6 xl:px-8">
        <AdminHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          alertsOnly={alertsOnly}
          onToggleAlerts={() => setAlertsOnly((value) => !value)}
          breadcrumbs={breadcrumbMap[activeConfig.id]}
          title={activeConfig.label}
          subtitle={activeConfig.id === "dashboard" ? "Live metrics, queues, and escalation workflows" : `Operational view for ${activeConfig.label.toLowerCase()}`}
          systemStatus={loading.overview ? "Syncing..." : "System healthy"}
          onExport={exportCurrentView}
          onToggleSidebar={() => setSidebarOpen(true)}
          isDark={isDark}
        />
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden xl:block">
            <AdminSidebar items={navItems} activeItem={activeConfig.id} onSelect={(id) => navigate(NAV_ITEMS.find((item) => item.id === id)?.path || "/dashboard")} isDark={isDark} />
          </div>
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-slate-950/50 xl:hidden" onClick={() => setSidebarOpen(false)}>
                <motion.div initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }} className="h-full max-w-[18rem] p-3" onClick={(event) => event.stopPropagation()}>
                  <AdminSidebar items={navItems} activeItem={activeConfig.id} onSelect={(id) => { navigate(NAV_ITEMS.find((item) => item.id === id)?.path || "/dashboard"); setSidebarOpen(false); }} isDark={isDark} onClose={() => setSidebarOpen(false)} />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="space-y-5">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={renderOverview()} />
              <Route path="/riders" element={renderRiders()} />
              <Route path="/drivers" element={renderDrivers()} />
              <Route path="/rides" element={renderRides()} />
              <Route path="/payments" element={renderPayments()} />
              <Route path="/approvals" element={renderApprovals()} />
              <Route path="/complaints" element={renderComplaints()} />
              <Route path="/analytics" element={renderAnalytics()} />
              <Route path="/settings" element={renderSettings()} />
            </Routes>
          </div>
        </div>
      </div>

      <Modal open={Boolean(kycModal)} title={kycModal ? `${kycModal.name} KYC` : "KYC"} onClose={() => setKycModal(null)} isDark={isDark}>
        {kycModal ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`rounded-[1.2rem] border p-4 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-2 font-semibold">{kycModal.kycStatus || "Pending review"}</p>
              <p className="mt-1 text-sm text-slate-500">{kycModal.city || "-"} • {kycModal.vehicleLabel || "Vehicle pending"}</p>
            </div>
            <div className="grid gap-3">
              {["Driving License", "Vehicle RC", "Insurance"].map((doc) => (
                <div key={doc} className={`rounded-[1.2rem] border p-4 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}>
                  <p className="font-medium">{doc}</p>
                  <p className="mt-1 text-sm text-slate-500">Preview unavailable in seed data. Plug actual document URLs here.</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(alertModal)} title={alertModal?.title || "Alert details"} onClose={() => setAlertModal(null)} isDark={isDark}>
        {alertModal ? (
          <div className="space-y-4">
            <div className={`rounded-[1.2rem] border p-4 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Severity</p>
              <p className="mt-2 font-semibold">{alertModal.severity}</p>
              <p className="mt-2 text-sm text-slate-500">{alertModal.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { actions.acknowledgeAlert(alertModal, "ACKNOWLEDGED"); setAlertModal(null); }} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold">Acknowledge</button>
              <button type="button" onClick={() => { actions.acknowledgeAlert(alertModal, "ESCALATED"); setAlertModal(null); }} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">Escalate</button>
              <button type="button" onClick={() => { actions.acknowledgeAlert(alertModal, "RESOLVED"); setAlertModal(null); }} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">Resolve</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default function AdminDashboard({ token = localStorage.getItem("token") || "", adminName = localStorage.getItem("name") || "Admin" }) {
  const initialRoute = (() => {
    if (typeof window === "undefined") return "/dashboard";
    const savedRoute = localStorage.getItem(ADMIN_ROUTE_STORAGE_KEY) || "/dashboard";
    if (VALID_ADMIN_PATHS.has(savedRoute)) return savedRoute === "/" ? "/dashboard" : savedRoute;
    localStorage.removeItem(ADMIN_ROUTE_STORAGE_KEY);
    return "/dashboard";
  })();
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AdminWorkspace token={token} adminName={adminName} />
    </MemoryRouter>
  );
}
