import { API_BASE_URL, apiRequest } from "../api.jsx";
import { buildMockDashboardSnapshot } from "../data/dashboardStats";

export const DASHBOARD_SECTION_KEYS = [
  "overview",
  "analytics",
  "users",
  "drivers",
  "rides",
  "payments",
  "complaints",
  "alerts",
  "settings",
  "pricing",
  "liveMap",
];

const ADMIN_ENDPOINTS = {
  overview: "/api/admin/overview",
  analytics: "/api/admin/analytics",
  users: "/api/admin/users",
  drivers: "/api/admin/drivers",
  rides: "/api/admin/rides",
  payments: "/api/admin/payments",
  complaints: "/api/admin/complaints",
  alerts: "/api/admin/alerts",
  settings: "/api/admin/settings",
  pricing: "/api/admin/pricing",
  liveMap: "/api/admin/live-map",
};

const simulationCatalog = {
  rides: [
    ["Neha", "Verma", "Mumbai", "Lower Parel", "Bandra Kurla Complex"],
    ["Arjun", "Rao", "Bengaluru", "Marathahalli", "Electronic City"],
    ["Sanya", "Kapoor", "Delhi", "Connaught Place", "Lajpat Nagar"],
    ["Harsh", "Kulkarni", "Pune", "Wakad", "Koregaon Park"],
  ],
  drivers: [
    ["Dev", "Malhotra", "Mumbai", "BKC"],
    ["Ira", "Shetty", "Bengaluru", "Whitefield"],
    ["Yash", "Mishra", "Delhi", "Aerocity"],
    ["Nitin", "Bose", "Hyderabad", "Gachibowli"],
  ],
  complaints: [
    ["Route mismatch reported after surge pricing", "ROUTE", "MEDIUM"],
    ["Driver delayed pickup beyond ETA promise", "CONDUCT", "LOW"],
    ["Wallet balance missing after promo redemption", "PAYMENT", "MEDIUM"],
    ["Night ride safety concern raised by rider", "SAFETY", "HIGH"],
  ],
};

const RANGE_CONFIG = {
  Today: { days: 1, kpiScale: 0.22, chartScale: 0.34, fallbackCount: 4 },
  Week: { days: 7, kpiScale: 0.72, chartScale: 0.78, fallbackCount: 6 },
  Month: { days: 30, kpiScale: 1.08, chartScale: 1.12, fallbackCount: 8 },
};

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoNow() {
  return new Date().toISOString();
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toDateLabel(date = new Date()) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function nextNumericId(list = [], key = "id", seed = 1000) {
  return list.reduce((max, item) => Math.max(max, safeNumber(item?.[key])), seed) + 1;
}

function updateLastTrendPoint(points, delta, label) {
  if (!Array.isArray(points) || points.length === 0) {
    return [{ label: label || toDateLabel(), value: delta }];
  }
  const nextPoints = points.slice(-8).map((item) => ({ ...item }));
  nextPoints[nextPoints.length - 1] = {
    ...nextPoints[nextPoints.length - 1],
    label: label || nextPoints[nextPoints.length - 1].label,
    value: Math.max(0, safeNumber(nextPoints[nextPoints.length - 1].value) + delta),
  };
  return nextPoints;
}

function appendOrReplaceRecent(points, delta) {
  const nextPoints = Array.isArray(points) ? points.map((item) => ({ ...item })) : [];
  const label = toDateLabel();
  if (nextPoints.length && nextPoints[nextPoints.length - 1]?.label === label) {
    nextPoints[nextPoints.length - 1] = {
      ...nextPoints[nextPoints.length - 1],
      value: Math.max(0, safeNumber(nextPoints[nextPoints.length - 1].value) + delta),
    };
    return nextPoints;
  }
  return nextPoints.concat({ label, value: delta }).slice(-9);
}

function filterItemsByRange(items = [], key, days, fallbackCount) {
  const boundary = Date.now() - days * 24 * 60 * 60 * 1000;
  const filteredItems = (items || []).filter((item) => toTimestamp(item?.[key]) >= boundary);
  if (filteredItems.length > 0) {
    return filteredItems;
  }
  return (items || []).slice(0, Math.min(fallbackCount, items.length));
}

function scaleSeries(points = [], factor, mapper) {
  return (points || []).map((point, index) => {
    const value = safeNumber(point?.value);
    return mapper
      ? mapper(point, index, factor)
      : { ...point, value: Math.max(0, Math.round(value * factor)) };
  });
}

function scaleDemandPoints(points = [], factor) {
  return (points || []).map((point) => ({
    ...point,
    activeDrivers: Math.max(1, Math.round(safeNumber(point.activeDrivers) * factor)),
    ongoingRides: Math.max(1, Math.round(safeNumber(point.ongoingRides) * factor)),
  }));
}

export function buildDateRangeSnapshot(snapshot, range = "Week") {
  const config = RANGE_CONFIG[range] || RANGE_CONFIG.Week;
  const nextSnapshot = clone(snapshot || buildFallbackSnapshot());

  const filteredUsers = filterItemsByRange(nextSnapshot.users.items, "lastActive", config.days, config.fallbackCount);
  const filteredDrivers = filterItemsByRange(nextSnapshot.drivers.items, "lastActive", config.days, config.fallbackCount);
  const filteredRides = filterItemsByRange(nextSnapshot.rides.items, "createdAt", config.days, config.fallbackCount);
  const filteredPayments = filterItemsByRange(nextSnapshot.payments.items, "createdAt", config.days, config.fallbackCount);
  const filteredComplaints = filterItemsByRange(nextSnapshot.complaints.items, "createdAt", config.days, config.fallbackCount);
  const filteredAlerts = filterItemsByRange(nextSnapshot.alerts.items, "createdAt", config.days, Math.max(2, config.fallbackCount - 2));
  const filteredLiveAlerts = filterItemsByRange(nextSnapshot.overview.liveAlerts, "createdAt", config.days, Math.max(2, config.fallbackCount - 2));

  let ridesByHour = scaleSeries(nextSnapshot.analytics.ridesByHour, config.chartScale);
  let dailyRevenue = scaleSeries(nextSnapshot.analytics.dailyRevenue, config.chartScale);
  let driverOnlineTrend = scaleSeries(nextSnapshot.analytics.driverOnlineTrend, config.chartScale);
  let cancellationTrend = scaleSeries(nextSnapshot.analytics.cancellationTrend, range === "Month" ? 1.08 : range === "Week" ? 1 : 0.9, (point, index, factor) => ({
    ...point,
    value: Number((safeNumber(point.value) * factor + index * 0.04).toFixed(1)),
  }));

  if (range === "Today") {
    ridesByHour = scaleSeries(nextSnapshot.analytics.ridesByHour.slice(-6), config.chartScale);
    dailyRevenue = scaleSeries(nextSnapshot.analytics.ridesByHour.slice(-6), 290, (point) => ({
      label: point.label,
      value: Math.round(safeNumber(point.value) * 290),
    }));
    driverOnlineTrend = scaleSeries(nextSnapshot.analytics.driverOnlineTrend.slice(-6), 0.42);
    cancellationTrend = scaleSeries(nextSnapshot.analytics.ridesByHour.slice(-6), 1, (point, index) => ({
      label: point.label,
      value: Number((2.1 + (safeNumber(point.value) % 5) * 0.28 + index * 0.08).toFixed(1)),
    }));
  }

  if (range === "Month") {
    ridesByHour = scaleSeries(nextSnapshot.analytics.ridesByHour, config.chartScale);
    dailyRevenue = scaleSeries(nextSnapshot.analytics.dailyRevenue, config.chartScale);
    driverOnlineTrend = scaleSeries(nextSnapshot.analytics.driverOnlineTrend, config.chartScale);
  }

  const cityDemand = scaleDemandPoints(nextSnapshot.analytics.cityDemand, range === "Today" ? 0.52 : config.chartScale);
  const activeDriverIds = new Set(filteredDrivers.map((item) => item.id));
  const visibleRideIds = new Set(filteredRides.map((item) => item.id));
  const visibleComplaintIds = new Set(filteredComplaints.map((item) => `complaint-${item.id}`));

  nextSnapshot.users = { ...nextSnapshot.users, items: filteredUsers, total: filteredUsers.length };
  nextSnapshot.drivers = { ...nextSnapshot.drivers, items: filteredDrivers, total: filteredDrivers.length };
  nextSnapshot.rides = { ...nextSnapshot.rides, items: filteredRides, total: filteredRides.length };
  nextSnapshot.payments = { ...nextSnapshot.payments, items: filteredPayments, total: filteredPayments.length };
  nextSnapshot.complaints = { ...nextSnapshot.complaints, items: filteredComplaints, total: filteredComplaints.length };
  nextSnapshot.alerts = { ...nextSnapshot.alerts, items: filteredAlerts, total: filteredAlerts.length };
  nextSnapshot.analytics = {
    ...nextSnapshot.analytics,
    ridesByHour,
    dailyRevenue,
    driverOnlineTrend,
    cancellationTrend,
    cityDemand,
  };
  nextSnapshot.liveMap = {
    ...nextSnapshot.liveMap,
    drivers: (() => {
      const visibleItems = (nextSnapshot.liveMap.drivers || []).filter((item) => activeDriverIds.has(item.id));
      return (visibleItems.length ? visibleItems : nextSnapshot.liveMap.drivers || []).slice(0, 8);
    })(),
    rides: (() => {
      const visibleItems = (nextSnapshot.liveMap.rides || []).filter((item) => visibleRideIds.has(item.id));
      return (visibleItems.length ? visibleItems : nextSnapshot.liveMap.rides || []).slice(0, 8);
    })(),
    sosAlerts: (() => {
      const visibleItems = (nextSnapshot.liveMap.sosAlerts || []).filter((item) => visibleComplaintIds.has(item.id));
      return (visibleItems.length ? visibleItems : nextSnapshot.liveMap.sosAlerts || []).slice(0, 4);
    })(),
    zones: cityDemand.slice(0, 5),
    generatedAt: isoNow(),
  };

  nextSnapshot.overview = {
    ...nextSnapshot.overview,
    kpis: {
      totalUsers: Math.max(filteredUsers.length, Math.round(safeNumber(nextSnapshot.overview.kpis.totalUsers) * config.kpiScale)),
      totalDrivers: Math.max(filteredDrivers.length, Math.round(safeNumber(nextSnapshot.overview.kpis.totalDrivers) * config.kpiScale)),
      activeDrivers: Math.max(nextSnapshot.liveMap.drivers.length, Math.round(safeNumber(nextSnapshot.overview.kpis.activeDrivers) * config.kpiScale)),
      ongoingRides: Math.max(nextSnapshot.liveMap.rides.length, Math.round(safeNumber(nextSnapshot.overview.kpis.ongoingRides) * config.kpiScale)),
      completedToday: Math.max(filteredRides.filter((item) => String(item.status).toUpperCase() === "COMPLETED").length, Math.round(safeNumber(nextSnapshot.overview.kpis.completedToday) * (range === "Today" ? 0.32 : range === "Week" ? 0.74 : 1.14))),
      revenueToday: Math.max(filteredPayments.reduce((sum, item) => sum + safeNumber(item.amount), 0), Math.round(safeNumber(nextSnapshot.overview.kpis.revenueToday) * (range === "Today" ? 0.29 : range === "Week" ? 0.79 : 1.16))),
      cancelledPercentage: Number((safeNumber(nextSnapshot.overview.kpis.cancelledPercentage) * (range === "Today" ? 0.94 : range === "Week" ? 1 : 1.08)).toFixed(1)),
      pendingComplaints: Math.max(filteredComplaints.length, Math.round(safeNumber(nextSnapshot.overview.kpis.pendingComplaints) * (range === "Today" ? 0.42 : range === "Week" ? 0.86 : 1.08))),
    },
    ridesPerHour: ridesByHour,
    revenueTrend: dailyRevenue,
    driverActivityTrend: driverOnlineTrend,
    rideCompletionTrend: cancellationTrend,
    zoneDemandHeatmap: cityDemand,
    liveAlerts: filteredLiveAlerts,
    generatedAt: isoNow(),
  };

  return nextSnapshot;
}

async function fetchSection(key, token, fallbackSnapshot) {
  const fallbackData = fallbackSnapshot[key];
  if (!token) {
    return { key, data: fallbackData, source: "fallback", error: new Error("Missing admin token") };
  }

  try {
    const data = await apiRequest(ADMIN_ENDPOINTS[key], "GET", null, token);
    return { key, data, source: "api", error: null };
  } catch (error) {
    return { key, data: fallbackData, source: "fallback", error };
  }
}

function deriveSnapshotSource(results) {
  const apiCount = results.filter((item) => item.source === "api").length;
  if (apiCount === results.length) {
    return "api";
  }
  if (apiCount === 0) {
    return "fallback";
  }
  return "hybrid";
}

export function buildFallbackSnapshot() {
  return buildMockDashboardSnapshot();
}

export function toDashboardWsUrl() {
  return `${API_BASE_URL.replace(/^http/i, "ws")}/ws`;
}

export async function fetchAdminDashboardSnapshot(token) {
  const fallbackSnapshot = buildFallbackSnapshot();
  const results = await Promise.all(DASHBOARD_SECTION_KEYS.map((key) => fetchSection(key, token, fallbackSnapshot)));
  const snapshot = results.reduce(
    (accumulator, item) => ({ ...accumulator, [item.key]: clone(item.data) }),
    {}
  );

  return {
    snapshot,
    source: deriveSnapshotSource(results),
    errors: results
      .filter((item) => item.error)
      .reduce((accumulator, item) => ({ ...accumulator, [item.key]: item.error.message || "Request failed" }), {}),
    generatedAt: isoNow(),
  };
}

export async function fetchAdminDashboardSections(token, keys = DASHBOARD_SECTION_KEYS) {
  const fallbackSnapshot = buildFallbackSnapshot();
  const requestedKeys = keys.filter((key) => DASHBOARD_SECTION_KEYS.includes(key));
  const results = await Promise.all(requestedKeys.map((key) => fetchSection(key, token, fallbackSnapshot)));
  return {
    sections: results.reduce((accumulator, item) => ({ ...accumulator, [item.key]: clone(item.data) }), {}),
    source: deriveSnapshotSource(results),
    errors: results
      .filter((item) => item.error)
      .reduce((accumulator, item) => ({ ...accumulator, [item.key]: item.error.message || "Request failed" }), {}),
    generatedAt: isoNow(),
  };
}

export function getWsRefreshConfig(topic) {
  const config = {
    "/topic/admin/overview": { keys: ["overview", "analytics"], message: "Live overview refreshed", eventType: "ADMIN_OVERVIEW" },
    "/topic/admin/rides": { keys: ["rides", "overview", "liveMap", "payments", "analytics"], message: "New ride activity detected", eventType: "NEW_RIDE_BOOKED" },
    "/topic/admin/safety": { keys: ["alerts", "complaints", "overview", "liveMap"], message: "Safety queue changed", eventType: "SOS_ALERT" },
    "/topic/admin/payments": { keys: ["payments", "overview"], message: "Payment feed updated", eventType: "NEW_PAYMENT" },
    "/topic/admin/pricing": { keys: ["pricing", "settings"], message: "Pricing controls refreshed", eventType: "PRICING_UPDATED" },
    "/topic/admin/zones": { keys: ["liveMap", "overview", "analytics"], message: "Zone map refreshed", eventType: "ZONE_UPDATED" },
    "/topic/admin/drivers": { keys: ["drivers", "overview", "liveMap", "analytics"], message: "Driver fleet updated", eventType: "DRIVER_APPROVED" },
  };
  return config[topic] || { keys: ["overview"], message: "Admin dashboard updated", eventType: "ADMIN_EVENT" };
}

export function createSimulationEvent(snapshot) {
  const events = ["NEW_RIDE_BOOKED", "NEW_PAYMENT", "SOS_ALERT", "NEW_COMPLAINT", "DRIVER_APPROVED"];
  const type = pickRandom(events);
  const current = clone(snapshot);
  const eventId = `sim-${type.toLowerCase()}-${Date.now()}`;

  if (type === "NEW_RIDE_BOOKED") {
    const [firstName, lastName, city, pickup, destination] = pickRandom(simulationCatalog.rides);
    const driver = pickRandom(current.drivers.items || []);
    return {
      type,
      eventId,
      message: `New ride booked from ${pickup}`,
      ride: {
        id: nextNumericId(current.rides.items, "id", 90431),
        riderName: `${firstName} ${lastName}`,
        driverName: driver?.name || "Driver assigning",
        pickup,
        destination,
        fare: 240 + Math.round(Math.random() * 320),
        paymentMode: pickRandom(["UPI", "CARD", "WALLET"]),
        paymentStatus: "AUTHORIZED",
        status: pickRandom(["REQUESTED", "ACCEPTED", "IN_PROGRESS"]),
        etaLabel: `${6 + Math.round(Math.random() * 8)} min`,
        createdAt: isoNow(),
      },
      city,
      driver,
    };
  }

  if (type === "NEW_PAYMENT") {
    const ride = pickRandom(current.rides.items || []);
    return {
      type,
      eventId,
      message: `Payment settled for Ride #${ride?.id || nextNumericId([], "rideId", 90431)}`,
      payment: {
        rideId: ride?.id || nextNumericId([], "rideId", 90431),
        riderName: ride?.riderName || "Wallet rider",
        driverName: ride?.driverName || "Auto-assigned driver",
        amount: ride?.fare || 312,
        paymentMode: ride?.paymentMode || "UPI",
        paymentStatus: "COMPLETED",
        paymentReference: `SIM-PAY-${Date.now()}`,
        settlementStatus: "SETTLED",
        createdAt: isoNow(),
      },
    };
  }

  if (type === "SOS_ALERT") {
    const ride = pickRandom(current.rides.items || []);
    return {
      type,
      eventId,
      message: `SOS alert raised for Ride #${ride?.id || nextNumericId([], "id", 90431)}`,
      alert: {
        id: `alert-${Date.now()}`,
        type,
        severity: "CRITICAL",
        title: `SOS raised near ${ride?.pickup || "active pickup zone"}`,
        subtitle: `${ride?.riderName || "A rider"} requested immediate intervention.`,
        status: "OPEN",
        createdAt: isoNow(),
      },
      complaint: {
        id: nextNumericId(current.complaints.items, "id", 4106),
        category: "SAFETY",
        severity: "CRITICAL",
        status: "ESCALATED",
        city: ride?.pickup?.split(" ").slice(-1).join(" ") || "Mumbai",
        subject: `Live SOS escalation for Ride #${ride?.id || 0}`,
        userName: ride?.riderName || "Rider",
        driverName: ride?.driverName || "Driver",
        rideId: ride?.id || null,
        assignedTo: "ops-safety",
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
  }

  if (type === "NEW_COMPLAINT") {
    const [subject, category, severity] = pickRandom(simulationCatalog.complaints);
    const ride = pickRandom(current.rides.items || []);
    return {
      type,
      eventId,
      message: "New complaint entered into support queue",
      complaint: {
        id: nextNumericId(current.complaints.items, "id", 4106),
        category,
        severity,
        status: "OPEN",
        city: pickRandom(["Mumbai", "Bengaluru", "Delhi", "Pune"]),
        subject,
        userName: ride?.riderName || "Support rider",
        driverName: ride?.driverName || "Assigned driver",
        rideId: ride?.id || null,
        assignedTo: "support-queue",
        createdAt: isoNow(),
        updatedAt: isoNow(),
      },
    };
  }

  const [firstName, lastName, city, zone] = pickRandom(simulationCatalog.drivers);
  return {
    type,
    eventId,
    message: `Driver KYC approved for ${firstName} ${lastName}`,
    driver: {
      id: nextNumericId(current.drivers.items, "id", 808),
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@ridesharelive.in`,
      city,
      online: true,
      blocked: false,
      kycStatus: "APPROVED",
      vehicleLabel: `Swift ${String(Date.now()).slice(-4)}`,
      assignedZone: zone,
      ratingAverage: 4.8,
      acceptancePercentage: 91.4,
      cancellationPercentage: 2.1,
      earningsToday: 0,
      lastActive: isoNow(),
      latitude: 19.07 + Math.random() * 0.3,
      longitude: 72.87 + Math.random() * 0.3,
    },
  };
}

export function applySimulationEvent(snapshot, event) {
  const nextSnapshot = clone(snapshot || buildFallbackSnapshot());

  if (!event) {
    return { snapshot: nextSnapshot, affected: [] };
  }

  if (event.type === "NEW_RIDE_BOOKED" && event.ride) {
    nextSnapshot.rides.items = [event.ride, ...(nextSnapshot.rides.items || [])].slice(0, 24);
    nextSnapshot.rides.total = Math.max(safeNumber(nextSnapshot.rides.total) + 1, nextSnapshot.rides.items.length);
    nextSnapshot.overview.kpis.ongoingRides = safeNumber(nextSnapshot.overview.kpis.ongoingRides) + 1;
    nextSnapshot.analytics.ridesByHour = appendOrReplaceRecent(nextSnapshot.analytics.ridesByHour, 1);
    nextSnapshot.overview.ridesPerHour = nextSnapshot.analytics.ridesByHour;
    nextSnapshot.liveMap.rides = [
      {
        id: event.ride.id,
        status: event.ride.status,
        pickup: event.ride.pickup,
        destination: event.ride.destination,
        driverLat: event.driver?.latitude || 19.076,
        driverLon: event.driver?.longitude || 72.8777,
      },
      ...(nextSnapshot.liveMap.rides || []),
    ].slice(0, 12);
    nextSnapshot.overview.generatedAt = isoNow();
    return { snapshot: nextSnapshot, affected: [{ section: "rides", id: event.ride.id }, { section: "liveMap", id: event.ride.id }] };
  }

  if (event.type === "NEW_PAYMENT" && event.payment) {
    nextSnapshot.payments.items = [event.payment, ...(nextSnapshot.payments.items || [])].slice(0, 24);
    nextSnapshot.payments.total = Math.max(safeNumber(nextSnapshot.payments.total) + 1, nextSnapshot.payments.items.length);
    nextSnapshot.overview.kpis.revenueToday = safeNumber(nextSnapshot.overview.kpis.revenueToday) + safeNumber(event.payment.amount);
    nextSnapshot.analytics.dailyRevenue = updateLastTrendPoint(nextSnapshot.analytics.dailyRevenue, safeNumber(event.payment.amount));
    nextSnapshot.overview.revenueTrend = nextSnapshot.analytics.dailyRevenue;
    return { snapshot: nextSnapshot, affected: [{ section: "payments", id: event.payment.rideId }] };
  }

  if (event.type === "SOS_ALERT" && event.alert && event.complaint) {
    nextSnapshot.alerts.items = [event.alert, ...(nextSnapshot.alerts.items || [])].slice(0, 12);
    nextSnapshot.alerts.total = nextSnapshot.alerts.items.length;
    nextSnapshot.overview.liveAlerts = [event.alert, ...(nextSnapshot.overview.liveAlerts || [])].slice(0, 6);
    nextSnapshot.complaints.items = [event.complaint, ...(nextSnapshot.complaints.items || [])].slice(0, 24);
    nextSnapshot.complaints.total = Math.max(safeNumber(nextSnapshot.complaints.total) + 1, nextSnapshot.complaints.items.length);
    nextSnapshot.overview.kpis.pendingComplaints = safeNumber(nextSnapshot.overview.kpis.pendingComplaints) + 1;
    nextSnapshot.liveMap.sosAlerts = [
      {
        id: `complaint-${event.complaint.id}`,
        title: event.complaint.subject,
        severity: event.complaint.severity,
        city: event.complaint.city,
        createdAt: event.complaint.createdAt,
      },
      ...(nextSnapshot.liveMap.sosAlerts || []),
    ].slice(0, 6);
    return {
      snapshot: nextSnapshot,
      affected: [
        { section: "alerts", id: event.alert.id },
        { section: "complaints", id: event.complaint.id },
      ],
    };
  }

  if (event.type === "NEW_COMPLAINT" && event.complaint) {
    nextSnapshot.complaints.items = [event.complaint, ...(nextSnapshot.complaints.items || [])].slice(0, 24);
    nextSnapshot.complaints.total = Math.max(safeNumber(nextSnapshot.complaints.total) + 1, nextSnapshot.complaints.items.length);
    nextSnapshot.overview.kpis.pendingComplaints = safeNumber(nextSnapshot.overview.kpis.pendingComplaints) + 1;
    return { snapshot: nextSnapshot, affected: [{ section: "complaints", id: event.complaint.id }] };
  }

  if (event.type === "DRIVER_APPROVED" && event.driver) {
    nextSnapshot.drivers.items = [event.driver, ...(nextSnapshot.drivers.items || [])].slice(0, 24);
    nextSnapshot.drivers.total = Math.max(safeNumber(nextSnapshot.drivers.total) + 1, nextSnapshot.drivers.items.length);
    nextSnapshot.overview.kpis.totalDrivers = safeNumber(nextSnapshot.overview.kpis.totalDrivers) + 1;
    nextSnapshot.overview.kpis.activeDrivers = safeNumber(nextSnapshot.overview.kpis.activeDrivers) + 1;
    nextSnapshot.analytics.driverOnlineTrend = appendOrReplaceRecent(nextSnapshot.analytics.driverOnlineTrend, 1);
    nextSnapshot.overview.driverActivityTrend = nextSnapshot.analytics.driverOnlineTrend;
    nextSnapshot.liveMap.drivers = [
      {
        id: event.driver.id,
        name: event.driver.name,
        latitude: event.driver.latitude,
        longitude: event.driver.longitude,
        online: true,
        zone: event.driver.assignedZone,
      },
      ...(nextSnapshot.liveMap.drivers || []),
    ].slice(0, 24);
    return {
      snapshot: nextSnapshot,
      affected: [
        { section: "drivers", id: event.driver.id },
        { section: "liveMap", id: event.driver.id },
      ],
    };
  }

  return { snapshot: nextSnapshot, affected: [] };
}
