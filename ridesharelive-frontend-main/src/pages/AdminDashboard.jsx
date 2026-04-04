import { lazy, Suspense, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import { CheckCircle2, Eye, LocateFixed, RefreshCcw, Save, Undo2, Wallet, XCircle } from "lucide-react";
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.jsx";
import AdminHeader from "../components/AdminHeader";
import AdminSidebar from "../components/AdminSidebar";
import AlertPanel from "../components/AlertPanel";
import ComplaintsTable from "../components/ComplaintsTable";
import DriverApprovalTable from "../components/DriverApprovalTable";
import LiveUpdateToast from "../components/LiveUpdateToast";
import OpsActionButton from "../components/OpsActionButton";
import { useLiveDashboardSimulation } from "../hooks/useLiveDashboardSimulation";
import { usePollingFallback } from "../hooks/usePollingFallback";
import { useWebSocketDashboard } from "../hooks/useWebSocketDashboard";
import { buildDateRangeSnapshot, DASHBOARD_SECTION_KEYS, fetchAdminDashboardSections, fetchAdminDashboardSnapshot } from "../services/dashboardService";
import { useDashboardStore } from "../store/dashboardStore";

const AdminKpiStickySection = lazy(() => import("../components/AdminKpiStickySection"));
const AdminOverviewCharts = lazy(() => import("../components/charts/AdminOverviewCharts"));
const AdminAnalyticsGrid = lazy(() => import("../components/charts/AdminAnalyticsGrid"));
const AdminLiveMapSection = lazy(() => import("../components/liveMap/AdminLiveMapSection"));
const VirtualizedDataTable = lazy(() => import("../components/tables/VirtualizedDataTable"));

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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function saveCsv(filename, rows) {
  if (!rows.length) {
    return false;
  }
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
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  return true;
}

function buildExportFilename(section, dateRange) {
  const stamp = new Intl.DateTimeFormat("en-CA").format(new Date());
  return `admin-${section}-${dateRange.toLowerCase()}-${stamp}.csv`;
}

function formatDateLabel(value) {
  if (!value) {
    return "Recent";
  }
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDashboardExportRows({ overviewCards, alerts, approvals, dateRange }) {
  return [
    ...overviewCards.map((card) => ({
      section: "metric",
      range: dateRange,
      label: card.label,
      value: card.formatter ? `${card.formatter(card.value)}${card.suffix || ""}` : `${card.value}${card.suffix || ""}`,
    })),
    ...alerts.map((alert) => ({
      section: "alert",
      range: dateRange,
      label: alert.title,
      severity: alert.severity,
      detail: alert.subtitle,
      createdAt: formatDateLabel(alert.createdAt),
    })),
    ...approvals.map((driver) => ({
      section: "pending_driver",
      range: dateRange,
      label: driver.name,
      city: driver.city,
      kycStatus: driver.kycStatus,
      vehicle: driver.vehicleLabel,
      lastActive: formatDateLabel(driver.lastActive),
    })),
  ];
}

function buildKycDocuments(row) {
  if (!row) {
    return [];
  }

  const reviewState = String(row.kycStatus || "PENDING").toUpperCase();
  const plate = String(row.vehicleLabel || "VEHICLE").split(" ").slice(-1)[0] || "VEHICLE";
  const cityCode = String(row.city || "IN").slice(0, 2).toUpperCase();
  const statusLabel = reviewState === "APPROVED" ? "Verified" : reviewState === "REJECTED" ? "Rejected" : "Under review";

  return [
    {
      title: "Driving License",
      code: `DL-${cityCode}-${row.id}`,
      note: `${statusLabel} for LMV commercial rides`,
    },
    {
      title: "Vehicle RC",
      code: `RC-${plate}`,
      note: `${row.vehicleLabel || "Vehicle pending"} registered in ${row.city || "India"}`,
    },
    {
      title: "Insurance",
      code: `POL-${String(row.id).padStart(5, "0")}`,
      note: `Coverage active, last KYC sync ${formatDateLabel(row.lastActive)}`,
    },
  ];
}

function Modal({ open, title, children, onClose, isDark }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose?.();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4"
          onClick={onClose}
          role="presentation"
        >
          <Motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-2xl rounded-[1.75rem] border p-5 shadow-2xl ${
              isDark
                ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.98),rgba(9,18,34,0.95))] text-slate-100"
                : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{title}</h3>
              <OpsActionButton compact isDark={isDark} onClick={onClose}>
                Close
              </OpsActionButton>
            </div>
            <div className="mt-4">{children}</div>
          </Motion.div>
        </Motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SectionCard({ title, eyebrow, children, isDark, actions }) {
  return (
    <section className={`rounded-[1.75rem] border p-5 ${
      isDark
        ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]"
        : "border-slate-200 bg-white/96"
    }`}>
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

function BlockFallback({ isDark = true, className = "h-72" }) {
  return (
    <div className={`loading-shimmer rounded-[1.75rem] border ${className} ${
      isDark
        ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))]"
        : "border-slate-200 bg-white/96"
    }`} />
  );
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
  const adminHeaderRef = useRef(null);
  const overviewChartsRef = useRef(null);

  const data = useDashboardStore((state) => state.data);
  const loading = useDashboardStore((state) => state.loadingByKey);
  const toast = useDashboardStore((state) => state.ui.toast);
  const highlightedRows = useDashboardStore((state) => state.ui.highlightedRows);
  const connection = useDashboardStore((state) => state.connection);
  const meta = useDashboardStore((state) => state.meta);
  const hydrateSnapshot = useDashboardStore((state) => state.hydrateSnapshot);
  const mergeSections = useDashboardStore((state) => state.mergeSections);
  const setLoading = useDashboardStore((state) => state.setLoading);
  const setConnection = useDashboardStore((state) => state.setConnection);
  const showToast = useDashboardStore((state) => state.showToast);
  const flashRows = useDashboardStore((state) => state.flashRows);

  const location = useLocation();
  const navigate = useNavigate();

  useWebSocketDashboard(token);
  usePollingFallback(token, Boolean(token) && connection.websocketStatus !== "connected");
  useLiveDashboardSimulation(!token || (connection.apiStatus === "fallback" && connection.websocketStatus !== "connected"));

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
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(DASHBOARD_SECTION_KEYS, true);
      setConnection({ apiStatus: "syncing" });
      const { snapshot, source, errors, generatedAt } = await fetchAdminDashboardSnapshot(token);
      if (cancelled) {
        return;
      }
      startTransition(() => {
        hydrateSnapshot(snapshot, { source, generatedAt, eventType: "BOOTSTRAP", errors });
      });
      setConnection({ apiStatus: source === "fallback" ? "fallback" : "ready" });
      if (source !== "api") {
        showToast({
          tone: source === "fallback" ? "warning" : "info",
          message: source === "fallback" ? "Backend unavailable, showing deploy-safe operations data" : "Hybrid data mode active",
        });
      }
      setLoading(DASHBOARD_SECTION_KEYS, false);
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [hydrateSnapshot, setConnection, setLoading, showToast, token]);

  useEffect(() => {
    setSettingsDraft(Object.fromEntries((data.settings.items || []).map((item) => [item.key, item.value || ""])));
  }, [data.settings.items]);

  useEffect(() => {
    setPricingDraft(
      Object.fromEntries(
        (data.pricing.items || []).map((item) => [
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
        ])
      )
    );
  }, [data.pricing.items]);

  const scopedData = useMemo(() => buildDateRangeSnapshot(data, dateRange), [data, dateRange]);

  const refreshSections = useCallback(async (keys, eventType = "MANUAL_REFRESH") => {
    setLoading(keys, true);
    const { sections, source, errors, generatedAt } = await fetchAdminDashboardSections(token, keys);
    startTransition(() => {
      mergeSections(sections, { source, generatedAt, eventType, errors });
    });
    setConnection({ apiStatus: source === "fallback" ? "fallback" : "ready" });
    setLoading(keys, false);
    return sections;
  }, [mergeSections, setConnection, setLoading, token]);

  const mutateAdminResource = useCallback(async (path, method, body, successMessage, keysToRefresh, affectedRows = [], tone = "success") => {
    try {
      await apiRequest(path, method, body, token);
      await refreshSections(keysToRefresh, "MUTATION_SYNC");
      if (affectedRows.length) {
        flashRows(affectedRows);
      }
      showToast({ tone, message: successMessage });
    } catch (error) {
      showToast({ tone: "warning", message: error.message || "Request failed" });
    }
  }, [flashRows, refreshSections, showToast, token]);

  const activeConfig = NAV_ITEMS.find((item) => location.pathname.includes(item.id)) || NAV_ITEMS[0];

  const filteredUsers = useMemo(() => (scopedData.users.items || []).filter((row) => !deferredSearch || `${row.name} ${row.email} ${row.city}`.toLowerCase().includes(deferredSearch)), [deferredSearch, scopedData.users.items]);
  const filteredDrivers = useMemo(() => (scopedData.drivers.items || []).filter((row) => !deferredSearch || `${row.name} ${row.email} ${row.city} ${row.assignedZone}`.toLowerCase().includes(deferredSearch)), [deferredSearch, scopedData.drivers.items]);
  const filteredRides = useMemo(() => (scopedData.rides.items || []).filter((row) => !deferredSearch || `${row.id} ${row.riderName} ${row.driverName} ${row.pickup} ${row.destination}`.toLowerCase().includes(deferredSearch)), [deferredSearch, scopedData.rides.items]);
  const filteredPayments = useMemo(() => (scopedData.payments.items || []).filter((row) => !deferredSearch || `${row.rideId} ${row.riderName} ${row.driverName} ${row.paymentMode} ${row.paymentStatus}`.toLowerCase().includes(deferredSearch)), [deferredSearch, scopedData.payments.items]);
  const filteredComplaints = useMemo(() => (scopedData.complaints.items || []).map((row) => ({ ...row, owner: `${row.userName} / ${row.driverName}`, severity: row.severity || "MEDIUM" })).filter((row) => !deferredSearch || `${row.subject} ${row.owner} ${row.city}`.toLowerCase().includes(deferredSearch)), [deferredSearch, scopedData.complaints.items]);
  const pendingApprovals = useMemo(() => filteredDrivers.filter((row) => ["PENDING", "REJECTED"].includes(String(row.kycStatus || "").toUpperCase())), [filteredDrivers]);

  const paymentMetrics = useMemo(() => {
    const payments = scopedData.payments.items || [];
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
  }, [scopedData.payments.items]);

  const navItems = useMemo(() => NAV_ITEMS.map((item) => {
    if (item.id === "drivers") return { ...item, badge: String(scopedData.overview?.kpis?.activeDrivers || 0) };
    if (item.id === "approvals") return { ...item, badge: String(pendingApprovals.length) };
    if (item.id === "complaints") return { ...item, badge: String(scopedData.overview?.kpis?.pendingComplaints || 0) };
    return item;
  }), [pendingApprovals.length, scopedData.overview?.kpis?.activeDrivers, scopedData.overview?.kpis?.pendingComplaints]);

  const overviewCards = useMemo(() => {
    const kpis = scopedData.overview?.kpis || {};
    const revenueTrend = (scopedData.analytics?.dailyRevenue || []).map((point) => point.value);
    const ridesTrend = (scopedData.analytics?.ridesByHour || []).map((point) => point.value);
    const driverTrend = (scopedData.analytics?.driverOnlineTrend || []).map((point) => point.value);
    const completionTrend = (scopedData.analytics?.cancellationTrend || []).map((point) => point.value);
    return [
      { label: "Total riders", value: kpis.totalUsers || 0, tone: "default", delta: 6.2, sparkline: ridesTrend },
      { label: "Total drivers", value: kpis.totalDrivers || 0, tone: "cyan", delta: 3.8, sparkline: driverTrend },
      { label: "Ongoing rides", value: kpis.ongoingRides || 0, tone: "green", delta: 4.4, sparkline: ridesTrend },
      { label: "Revenue today", value: Number(kpis.revenueToday || 0), tone: "green", delta: 8.9, sparkline: revenueTrend, formatter: (value) => formatCurrency(value), suffix: "" },
      { label: "Completed today", value: kpis.completedToday || 0, tone: "green", delta: 5.1, sparkline: ridesTrend },
      { label: "Cancelled %", value: Number(kpis.cancelledPercentage || 0), tone: "rose", delta: -1.6, sparkline: completionTrend, formatter: (value) => Number(value).toFixed(1), suffix: "%" },
      { label: "Pending complaints", value: kpis.pendingComplaints || 0, tone: "amber", delta: 2.4, sparkline: completionTrend },
      { label: "Live alerts", value: scopedData.alerts.total || 0, tone: "rose", delta: 1.1, sparkline: completionTrend },
    ];
  }, [scopedData.alerts.total, scopedData.analytics, scopedData.overview]);

  const exportCurrentView = useCallback(() => {
    let rows = [];
    let filename = buildExportFilename(activeConfig.id, dateRange);

    if (activeConfig.id === "riders") rows = filteredUsers;
    else if (activeConfig.id === "drivers" || activeConfig.id === "approvals") rows = filteredDrivers;
    else if (activeConfig.id === "rides") rows = filteredRides;
    else if (activeConfig.id === "payments") rows = filteredPayments;
    else if (activeConfig.id === "complaints") rows = filteredComplaints;
    else if (activeConfig.id === "settings") rows = data.settings.items || [];
    else rows = buildDashboardExportRows({ overviewCards, alerts: scopedData.alerts.items || [], approvals: pendingApprovals, dateRange });

    if (!saveCsv(filename, rows)) {
      showToast({ tone: "warning", message: `No ${activeConfig.label.toLowerCase()} data available for ${dateRange.toLowerCase()}` });
    } else {
      showToast({ tone: "success", message: `${filename} downloaded` });
    }
  }, [activeConfig.id, activeConfig.label, data.settings.items, dateRange, filteredComplaints, filteredDrivers, filteredPayments, filteredRides, filteredUsers, overviewCards, pendingApprovals, scopedData.alerts.items, showToast]);

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

  const approveDriver = useCallback((row) => mutateAdminResource(`/api/admin/drivers/${row.id}/approve`, "POST", null, `${row.name} approved`, ["drivers", "overview", "liveMap", "analytics"], [{ section: "drivers", id: row.id }], "success"), [mutateAdminResource]);
  const rejectDriver = useCallback((row) => mutateAdminResource(`/api/admin/drivers/${row.id}/reject`, "POST", null, `${row.name} rejected`, ["drivers", "overview", "liveMap", "analytics"], [{ section: "drivers", id: row.id }], "warning"), [mutateAdminResource]);
  const acknowledgeAlert = useCallback((alert, status = "ACKNOWLEDGED") => mutateAdminResource(`/api/admin/alerts/${encodeURIComponent(alert.id)}/acknowledge`, "PATCH", { status }, `${alert.title} ${status.toLowerCase()}`, ["alerts", "overview", "complaints", "liveMap"], [{ section: "alerts", id: alert.id }], "success"), [mutateAdminResource]);
  const complaintAction = useCallback((row, action, note = "") => mutateAdminResource(`/api/admin/complaints/${row.id}`, "PATCH", { action, note }, `${row.subject} updated`, ["complaints", "alerts", "overview", "payments", "liveMap"], [{ section: "complaints", id: row.id }], "success"), [mutateAdminResource]);
  const rideAction = useCallback((row, action) => mutateAdminResource(`/api/admin/rides/${row.id}`, "PATCH", { action }, `Ride #${row.id} updated`, ["rides", "overview", "liveMap", "payments", "analytics"], [{ section: "rides", id: row.id }], "success"), [mutateAdminResource]);
  const paymentAction = useCallback((row, action) => mutateAdminResource(`/api/admin/payments/${row.rideId}`, "POST", { action }, `Payment ${action.toLowerCase().replace("_", " ")}`, ["payments", "overview"], [{ section: "payments", id: row.rideId }], "success"), [mutateAdminResource]);
  const userAction = useCallback((row, action) => mutateAdminResource(`/api/admin/users/${row.id}`, "PATCH", { action }, `${row.name} updated`, ["users", "overview"], [{ section: "users", id: row.id }], "success"), [mutateAdminResource]);
  const saveSettings = useCallback(async (items) => mutateAdminResource("/api/admin/settings", "PUT", { items }, "Settings saved", ["settings", "overview"], [], "success"), [mutateAdminResource]);
  const savePricing = useCallback(async (items) => mutateAdminResource("/api/admin/pricing", "PUT", { items }, "Pricing updated", ["pricing", "overview"], [], "success"), [mutateAdminResource]);

  const renderOverview = () => (
    <div className="space-y-5">
      <Suspense fallback={<BlockFallback isDark={isDark} className="h-[20rem]" />}>
        <AdminKpiStickySection cards={overviewCards} isDark={isDark} chartsRef={overviewChartsRef} headerRef={adminHeaderRef} />
      </Suspense>
      {!alertsOnly ? (
        <div ref={overviewChartsRef} className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Suspense fallback={<BlockFallback isDark={isDark} className="h-[36rem]" />}>
            <AdminOverviewCharts analytics={scopedData.analytics} isDark={isDark} formatCurrency={formatCurrency} />
          </Suspense>
          <Suspense fallback={<BlockFallback isDark={isDark} className="h-[42rem]" />}>
            <AdminLiveMapSection mapData={scopedData.liveMap} paymentMetrics={paymentMetrics} isDark={isDark} connectionLabel={`${dateRange} snapshot`} />
          </Suspense>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <DriverApprovalTable rows={pendingApprovals.slice(0, 6)} onApprove={approveDriver} onReject={rejectDriver} onViewKyc={setKycModal} isDark={isDark} loading={loading.drivers} />
        <AlertPanel alerts={scopedData.alerts.items || []} onOpen={setAlertModal} onAcknowledge={(alert) => acknowledgeAlert(alert, "ACKNOWLEDGED")} onResolve={(alert) => acknowledgeAlert(alert, "RESOLVED")} onEscalate={(alert) => acknowledgeAlert(alert, "ESCALATED")} isDark={isDark} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ComplaintsTable rows={filteredComplaints.slice(0, 5)} onResolve={(row) => complaintAction(row, "RESOLVE")} onEscalate={(row) => complaintAction(row, "ESCALATE")} onAssign={(row) => complaintAction(row, "ASSIGN_SUPPORT_TICKET", "ops-auto")} isDark={isDark} loading={loading.complaints} />
        <SectionCard title="Operations activity" eyebrow="Timeline" isDark={isDark}>
          <div className="space-y-3">
            {(scopedData.overview?.liveAlerts || []).map((item) => (
              <div key={item.id} className={`rounded-[1.2rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
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
      <Suspense fallback={<BlockFallback isDark={isDark} className="h-[32rem]" />}>
        <VirtualizedDataTable
          columns={[
            {
              key: "name",
              label: "Rider",
              width: "minmax(220px,1.5fr)",
              render: (row) => (
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.email}</p>
                </div>
              ),
            },
            { key: "city", label: "City", width: "140px" },
            { key: "walletBalance", label: "Wallet", width: "120px", render: (row) => formatCurrency(row.walletBalance) },
            { key: "complaintsCount", label: "Complaints", width: "120px" },
            { key: "totalTrips", label: "Trips", width: "100px" },
            { key: "totalSpending", label: "Spending", width: "140px", render: (row) => formatCurrency(row.totalSpending) },
          ]}
          rows={filteredUsers}
          isDark={isDark}
          loading={loading.users}
          highlightedRows={highlightedRows.users}
          rowActions={(row) => (
            <>
              <OpsActionButton compact icon={Eye} isDark={isDark} onClick={() => userAction(row, "VIEW")}>
                View
              </OpsActionButton>
              <OpsActionButton compact icon={Undo2} variant="success" isDark={isDark} onClick={() => userAction(row, "REFUND")}>
                Refund
              </OpsActionButton>
              <OpsActionButton compact icon={row.blocked ? CheckCircle2 : XCircle} variant={row.blocked ? "success" : "danger"} isDark={isDark} onClick={() => userAction(row, row.blocked ? "ACTIVATE" : "SUSPEND")}>
                {row.blocked ? "Activate" : "Suspend"}
              </OpsActionButton>
            </>
          )}
        />
      </Suspense>
    </SectionCard>
  );

  const renderDrivers = () => (
    <SectionCard title="Driver fleet" eyebrow="Drivers" isDark={isDark}>
      <Suspense fallback={<BlockFallback isDark={isDark} className="h-[32rem]" />}>
        <VirtualizedDataTable
          columns={[
            {
              key: "name",
              label: "Driver",
              width: "minmax(220px,1.5fr)",
              render: (row) => (
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.email}</p>
                </div>
              ),
            },
            { key: "city", label: "City", width: "140px" },
            { key: "kycStatus", label: "KYC", width: "120px" },
            { key: "assignedZone", label: "Zone", width: "140px" },
            { key: "acceptancePercentage", label: "Accept %", width: "110px", render: (row) => formatPercent(row.acceptancePercentage) },
            { key: "earningsToday", label: "Today", width: "130px", render: (row) => formatCurrency(row.earningsToday) },
          ]}
          rows={filteredDrivers}
          isDark={isDark}
          loading={loading.drivers}
          highlightedRows={highlightedRows.drivers}
          rowActions={(row) => (
            <>
              <OpsActionButton compact icon={Eye} isDark={isDark} onClick={() => setKycModal(row)}>
                KYC
              </OpsActionButton>
              <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => approveDriver(row)}>
                Approve
              </OpsActionButton>
              <OpsActionButton compact icon={XCircle} variant="danger" isDark={isDark} onClick={() => rejectDriver(row)}>
                Reject
              </OpsActionButton>
            </>
          )}
        />
      </Suspense>
    </SectionCard>
  );

  const renderRides = () => (
    <SectionCard title="Live ride management" eyebrow="Rides" isDark={isDark}>
      <Suspense fallback={<BlockFallback isDark={isDark} className="h-[32rem]" />}>
        <VirtualizedDataTable
          columns={[
            { key: "id", label: "Ride", width: "110px" },
            { key: "riderName", label: "Rider", width: "160px" },
            { key: "driverName", label: "Driver", width: "160px" },
            { key: "pickup", label: "Pickup", width: "190px" },
            { key: "destination", label: "Drop", width: "190px" },
            { key: "fare", label: "Fare", width: "120px", render: (row) => formatCurrency(row.fare) },
            { key: "status", label: "Status", width: "120px" },
            { key: "etaLabel", label: "ETA", width: "90px" },
          ]}
          rows={filteredRides}
          isDark={isDark}
          loading={loading.rides}
          highlightedRows={highlightedRows.rides}
          rowActions={(row) => (
            <>
              <OpsActionButton compact icon={LocateFixed} isDark={isDark} onClick={() => rideAction(row, "TRACK_LIVE")}>
                Track
              </OpsActionButton>
              <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => rideAction(row, "MANUAL_COMPLETE")}>
                Complete
              </OpsActionButton>
              <OpsActionButton compact icon={XCircle} variant="danger" isDark={isDark} onClick={() => rideAction(row, "CANCEL_RIDE")}>
                Cancel
              </OpsActionButton>
            </>
          )}
        />
      </Suspense>
    </SectionCard>
  );

  const renderPayments = () => (
    <div className="space-y-5">
      <Suspense fallback={<BlockFallback isDark={isDark} className="h-[26rem]" />}>
        <AdminLiveMapSection mapData={{ ...scopedData.liveMap, zones: [] }} paymentMetrics={paymentMetrics} isDark={isDark} connectionLabel={`${dateRange} settlements`} />
      </Suspense>
      <SectionCard title="Transactions and settlements" eyebrow="Payments" isDark={isDark}>
        <Suspense fallback={<BlockFallback isDark={isDark} className="h-[32rem]" />}>
          <VirtualizedDataTable
            columns={[
              { key: "rideId", label: "Ride", width: "100px" },
              { key: "riderName", label: "Rider", width: "160px" },
              { key: "driverName", label: "Driver", width: "160px" },
              { key: "amount", label: "Amount", width: "120px", render: (row) => formatCurrency(row.amount) },
              { key: "paymentMode", label: "Mode", width: "110px" },
              { key: "paymentStatus", label: "Status", width: "140px" },
              { key: "settlementStatus", label: "Settlement", width: "140px" },
            ]}
            rows={filteredPayments}
            isDark={isDark}
            loading={loading.payments}
            highlightedRows={highlightedRows.payments}
            rowActions={(row) => (
              <>
                <OpsActionButton compact icon={RefreshCcw} isDark={isDark} onClick={() => paymentAction(row, "RETRY_FAILED")}>
                  Retry
                </OpsActionButton>
                <OpsActionButton compact icon={Undo2} variant="warning" isDark={isDark} onClick={() => paymentAction(row, "MANUAL_REFUND")}>
                  Refund
                </OpsActionButton>
                <OpsActionButton compact icon={Wallet} variant="success" isDark={isDark} onClick={() => paymentAction(row, "SETTLEMENT_LOG")}>
                  Settle
                </OpsActionButton>
              </>
            )}
          />
        </Suspense>
      </SectionCard>
    </div>
  );

  const renderApprovals = () => (
    <DriverApprovalTable rows={pendingApprovals} onApprove={approveDriver} onReject={rejectDriver} onViewKyc={setKycModal} isDark={isDark} loading={loading.drivers} />
  );

  const renderComplaints = () => (
    <ComplaintsTable rows={filteredComplaints} onResolve={(row) => complaintAction(row, "RESOLVE")} onEscalate={(row) => complaintAction(row, "ESCALATE")} onAssign={(row) => complaintAction(row, "ASSIGN_SUPPORT_TICKET", `${adminName || "admin"} assigned`)} isDark={isDark} loading={loading.complaints} />
  );

  const renderAnalytics = () => (
    <Suspense fallback={<BlockFallback isDark={isDark} className="h-[42rem]" />}>
      <AdminAnalyticsGrid analytics={scopedData.analytics} isDark={isDark} formatCurrency={formatCurrency} />
    </Suspense>
  );

  const renderSettings = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <SectionCard title="Platform settings" eyebrow="Config" isDark={isDark} actions={
        <OpsActionButton icon={Save} variant="primary" isDark={isDark} onClick={() => saveSettings(Object.entries(settingsDraft).map(([key, value]) => ({ key, value, category: key.split(".")[0] })))}>
          Save settings
        </OpsActionButton>
      }>
        <div className="grid gap-3">
          {(data.settings.items || []).map((item) => (
            <label key={item.key} className="grid gap-2">
              <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>{SETTINGS_LABELS[item.key] || item.key}</span>
              <input value={settingsDraft[item.key] ?? ""} onChange={(event) => setSettingsDraft((previous) => ({ ...previous, [item.key]: event.target.value }))} className={`rounded-[1rem] border px-3 py-3 text-sm ${isDark ? "border-slate-700/70 bg-[#0d1729] text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"}`} />
            </label>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Dynamic pricing" eyebrow="Pricing" isDark={isDark} actions={
        <OpsActionButton icon={Save} variant="primary" isDark={isDark} onClick={() => savePricing(Object.values(pricingDraft).map((item) => ({ ...item, baseFare: Number(item.baseFare), perKmRate: Number(item.perKmRate), perMinuteRate: Number(item.perMinuteRate), ruralMultiplier: Number(item.ruralMultiplier), cityTierMultiplier: Number(item.cityTierMultiplier), nightChargeMultiplier: Number(item.nightChargeMultiplier), peakMultiplier: Number(item.peakMultiplier), maxSurgeMultiplier: Number(item.maxSurgeMultiplier), tollFee: Number(item.tollFee), bookingFee: Number(item.bookingFee) })))}>
          Save pricing
        </OpsActionButton>
      }>
        <div className="space-y-4">
          {(data.pricing.items || []).map((item) => (
            <div key={item.rideType} className={`rounded-[1.2rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
              <p className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.rideType}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {["baseFare", "perKmRate", "perMinuteRate", "ruralMultiplier", "nightChargeMultiplier", "maxSurgeMultiplier"].map((field) => (
                  <label key={field} className="grid gap-1">
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{field}</span>
                    <input
                      value={pricingDraft[item.rideType]?.[field] ?? ""}
                      onChange={(event) => setPricingDraft((previous) => ({ ...previous, [item.rideType]: { ...previous[item.rideType], [field]: event.target.value } }))}
                      className={`rounded-[0.95rem] border px-3 py-2 text-sm ${isDark ? "border-slate-700/70 bg-[#0d1729] text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
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
    <section className={isDark ? "min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,35,63,0.38),transparent_26%),linear-gradient(180deg,#020611_0%,#071220_52%,#0a1527_100%)] text-slate-100" : "min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900"}>
      <LiveUpdateToast toast={toast} />
      <div className="mx-auto max-w-[96rem] space-y-6 px-4 pb-8 sm:px-6 xl:px-8">
        <AdminHeader ref={adminHeaderRef} searchValue={searchQuery} onSearchChange={setSearchQuery} dateRange={dateRange} onDateRangeChange={setDateRange} alertsOnly={alertsOnly} onToggleAlerts={() => setAlertsOnly((value) => !value)} breadcrumbs={breadcrumbMap[activeConfig.id]} title={activeConfig.label} subtitle={activeConfig.id === "dashboard" ? "Live metrics, queues, and escalation workflows" : `Operational view for ${activeConfig.label.toLowerCase()}`} updatedAt={meta.lastUpdatedAt} onExport={exportCurrentView} onToggleSidebar={() => setSidebarOpen(true)} isDark={isDark} />
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden xl:block">
            <AdminSidebar items={navItems} activeItem={activeConfig.id} onSelect={(id) => navigate(NAV_ITEMS.find((item) => item.id === id)?.path || "/dashboard")} isDark={isDark} />
          </div>
          <AnimatePresence>
            {sidebarOpen ? (
              <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-slate-950/50 xl:hidden" onClick={() => setSidebarOpen(false)}>
                <Motion.div initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }} className="h-full max-w-[18rem] p-3" onClick={(event) => event.stopPropagation()}>
                  <AdminSidebar items={navItems} activeItem={activeConfig.id} onSelect={(id) => { navigate(NAV_ITEMS.find((item) => item.id === id)?.path || "/dashboard"); setSidebarOpen(false); }} isDark={isDark} onClose={() => setSidebarOpen(false)} />
                </Motion.div>
              </Motion.div>
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
            <div className={`rounded-[1.2rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-2 font-semibold">{kycModal.kycStatus || "Pending review"}</p>
              <p className="mt-1 text-sm text-slate-500">{kycModal.city || "-"} | {kycModal.vehicleLabel || "Vehicle pending"}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[1rem] border px-3 py-3 ${isDark ? "border-slate-700/70 bg-[#09121f]" : "border-slate-200 bg-white"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Zone</p>
                  <p className="mt-2 text-sm font-semibold">{kycModal.assignedZone || "Awaiting zone"}</p>
                </div>
                <div className={`rounded-[1rem] border px-3 py-3 ${isDark ? "border-slate-700/70 bg-[#09121f]" : "border-slate-200 bg-white"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last active</p>
                  <p className="mt-2 text-sm font-semibold">{formatDateLabel(kycModal.lastActive)}</p>
                </div>
                <div className={`rounded-[1rem] border px-3 py-3 ${isDark ? "border-slate-700/70 bg-[#09121f]" : "border-slate-200 bg-white"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Acceptance</p>
                  <p className="mt-2 text-sm font-semibold">{formatPercent(kycModal.acceptancePercentage)}</p>
                </div>
                <div className={`rounded-[1rem] border px-3 py-3 ${isDark ? "border-slate-700/70 bg-[#09121f]" : "border-slate-200 bg-white"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Today earnings</p>
                  <p className="mt-2 text-sm font-semibold">{formatCurrency(kycModal.earningsToday)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              {buildKycDocuments(kycModal).map((doc) => (
                <div key={doc.title} className={`rounded-[1.2rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{doc.title}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${String(kycModal.kycStatus || "").toUpperCase() === "APPROVED" ? (isDark ? "border border-emerald-400/18 bg-emerald-400/[0.08] text-emerald-100" : "bg-emerald-100 text-emerald-700") : isDark ? "border border-amber-400/18 bg-amber-400/[0.08] text-amber-100" : "bg-amber-100 text-amber-700"}`}>
                      {String(kycModal.kycStatus || "PENDING").toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-300">{doc.code}</p>
                  <p className="mt-1 text-sm text-slate-500">{doc.note}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(alertModal)} title={alertModal?.title || "Alert details"} onClose={() => setAlertModal(null)} isDark={isDark}>
        {alertModal ? (
          <div className="space-y-4">
            <div className={`rounded-[1.2rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Severity</p>
              <p className="mt-2 font-semibold">{alertModal.severity}</p>
              <p className="mt-2 text-sm text-slate-500">{alertModal.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <OpsActionButton compact isDark={isDark} onClick={() => { acknowledgeAlert(alertModal, "ACKNOWLEDGED"); setAlertModal(null); }}>Acknowledge</OpsActionButton>
              <OpsActionButton compact variant="warning" isDark={isDark} onClick={() => { acknowledgeAlert(alertModal, "ESCALATED"); setAlertModal(null); }}>Escalate</OpsActionButton>
              <OpsActionButton compact variant="success" isDark={isDark} onClick={() => { acknowledgeAlert(alertModal, "RESOLVED"); setAlertModal(null); }}>Resolve</OpsActionButton>
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
