import { mockAlerts, mockLiveAlerts } from "./alertsData";
import {
  mockCancellationTrend,
  mockCityDemand,
  mockDailyRevenue,
  mockDriverOnlineTrend,
  mockRidesByHour,
} from "./chartData";
import { mockComplaintsQueue } from "./complaintsData";
import { mockDriverFleet, mockDrivers } from "./driversData";

const now = Date.now();

const isoMinutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();
const isoHoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();
const isoDaysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

export const mockUsers = {
  items: [
    { id: 1001, name: "Priya Sharma", email: "priya.sharma@example.com", city: "Mumbai", active: true, blocked: false, walletBalance: 780, complaintsCount: 1, lastActive: isoMinutesAgo(18), totalSpending: 12480, totalTrips: 62 },
    { id: 1002, name: "Rohan Das", email: "rohan.das@example.com", city: "Bengaluru", active: true, blocked: false, walletBalance: 520, complaintsCount: 1, lastActive: isoHoursAgo(2), totalSpending: 9100, totalTrips: 44 },
    { id: 1003, name: "Manya Gupta", email: "manya.gupta@example.com", city: "Gurugram", active: true, blocked: false, walletBalance: 1160, complaintsCount: 0, lastActive: isoHoursAgo(7), totalSpending: 15220, totalTrips: 81 },
    { id: 1004, name: "Ankit Jadhav", email: "ankit.jadhav@example.com", city: "Pune", active: true, blocked: false, walletBalance: 260, complaintsCount: 1, lastActive: isoHoursAgo(22), totalSpending: 6760, totalTrips: 31 },
    { id: 1005, name: "Nisha Reddy", email: "nisha.reddy@example.com", city: "Hyderabad", active: true, blocked: false, walletBalance: 940, complaintsCount: 1, lastActive: isoDaysAgo(2), totalSpending: 10340, totalTrips: 49 },
    { id: 1006, name: "Aditi Bansal", email: "aditi.bansal@example.com", city: "Delhi", active: true, blocked: false, walletBalance: 430, complaintsCount: 2, lastActive: isoDaysAgo(5), totalSpending: 8340, totalTrips: 37 },
    { id: 1007, name: "Kunal Menon", email: "kunal.menon@example.com", city: "Chennai", active: true, blocked: false, walletBalance: 560, complaintsCount: 0, lastActive: isoDaysAgo(12), totalSpending: 7240, totalTrips: 29 },
    { id: 1008, name: "Meera Sethi", email: "meera.sethi@example.com", city: "Noida", active: true, blocked: false, walletBalance: 1110, complaintsCount: 0, lastActive: isoDaysAgo(24), totalSpending: 16780, totalTrips: 88 },
  ],
  total: 12842,
};

export const mockRides = {
  items: [
    { id: 90431, riderName: "Priya Sharma", driverName: "Aarav Mehta", pickup: "BKC Tower 2", destination: "Terminal 2", fare: 542, paymentMode: "CARD", paymentStatus: "AUTHORIZED", status: "IN_PROGRESS", etaLabel: "11 min", createdAt: isoMinutesAgo(16) },
    { id: 90422, riderName: "Rohan Das", driverName: "Vihaan Nair", pickup: "ITPL Main Gate", destination: "Koramangala 80 Ft", fare: 388, paymentMode: "CARD", paymentStatus: "FAILED", status: "IN_PROGRESS", etaLabel: "8 min", createdAt: isoHoursAgo(4) },
    { id: 90419, riderName: "Manya Gupta", driverName: "Kabir Singh", pickup: "CyberHub", destination: "Golf Course Road", fare: 295, paymentMode: "UPI", paymentStatus: "COMPLETED", status: "COMPLETED", etaLabel: "-", createdAt: isoHoursAgo(13) },
    { id: 90408, riderName: "Ankit Jadhav", driverName: "Ishita Kulkarni", pickup: "Phase 2 Gate", destination: "Baner High Street", fare: 264, paymentMode: "CASH", paymentStatus: "PENDING", status: "ACCEPTED", etaLabel: "6 min", createdAt: isoDaysAgo(1.5) },
    { id: 90398, riderName: "Nisha Reddy", driverName: "Tanvi Reddy", pickup: "Raidurg Metro", destination: "Financial District", fare: 311, paymentMode: "UPI", paymentStatus: "COMPLETED", status: "COMPLETED", etaLabel: "-", createdAt: isoDaysAgo(2.8) },
    { id: 90387, riderName: "Aditi Bansal", driverName: "Sana Khan", pickup: "Aerocity Plaza", destination: "Vasant Kunj", fare: 446, paymentMode: "CARD", paymentStatus: "REFUND_PENDING", status: "CANCELLED", etaLabel: "-", createdAt: isoDaysAgo(5.2) },
    { id: 90371, riderName: "Kunal Menon", driverName: "Rohit Patil", pickup: "Powai Lake", destination: "Andheri East", fare: 271, paymentMode: "UPI", paymentStatus: "COMPLETED", status: "COMPLETED", etaLabel: "-", createdAt: isoDaysAgo(12) },
    { id: 90364, riderName: "Meera Sethi", driverName: "Tanvi Reddy", pickup: "Inorbit Mall", destination: "Hitech City", fare: 358, paymentMode: "WALLET", paymentStatus: "COMPLETED", status: "COMPLETED", etaLabel: "-", createdAt: isoDaysAgo(24) },
  ],
  total: 143,
};

export const mockPayments = {
  items: mockRides.items.map((ride, index) => ({
    rideId: ride.id,
    riderName: ride.riderName,
    driverName: ride.driverName,
    amount: ride.fare,
    paymentMode: ride.paymentMode,
    paymentStatus: ride.paymentStatus,
    paymentReference: `PAY-${ride.id}-${index + 1}`,
    settlementStatus: ride.paymentStatus === "COMPLETED" ? "SETTLED" : ride.paymentStatus === "FAILED" ? "BLOCKED" : "PENDING",
    createdAt: ride.createdAt,
  })),
  total: 8,
};

export const mockSettings = {
  items: [
    { id: 1, key: "pricing.surgeCap", value: "2.2", category: "pricing", updatedAt: isoMinutesAgo(82) },
    { id: 2, key: "pricing.nightCharge", value: "1.15", category: "pricing", updatedAt: isoMinutesAgo(82) },
    { id: 3, key: "routing.ruralRate", value: "1.35", category: "routing", updatedAt: isoMinutesAgo(215) },
    { id: 4, key: "mail.smtpHost", value: "smtp.resend.com", category: "mail", updatedAt: isoMinutesAgo(342) },
    { id: 5, key: "maintenance.enabled", value: "false", category: "maintenance", updatedAt: isoMinutesAgo(518) },
  ],
  updatedAt: isoMinutesAgo(82),
};

export const mockPricing = {
  items: [
    { id: 21, rideType: "MICRO", baseFare: 48, perKmRate: 12, perMinuteRate: 2.4, ruralMultiplier: 1.22, cityTierMultiplier: 1.08, nightChargeMultiplier: 1.15, peakMultiplier: 1.38, maxSurgeMultiplier: 2.2, tollFee: 0, bookingFee: 12, updatedAt: isoMinutesAgo(61) },
    { id: 22, rideType: "SEDAN", baseFare: 82, perKmRate: 16, perMinuteRate: 3.2, ruralMultiplier: 1.28, cityTierMultiplier: 1.12, nightChargeMultiplier: 1.18, peakMultiplier: 1.45, maxSurgeMultiplier: 2.4, tollFee: 0, bookingFee: 16, updatedAt: isoMinutesAgo(61) },
    { id: 23, rideType: "SUV", baseFare: 124, perKmRate: 22, perMinuteRate: 4.1, ruralMultiplier: 1.34, cityTierMultiplier: 1.15, nightChargeMultiplier: 1.2, peakMultiplier: 1.58, maxSurgeMultiplier: 2.6, tollFee: 0, bookingFee: 20, updatedAt: isoMinutesAgo(61) },
  ],
  updatedAt: isoMinutesAgo(61),
};

export const mockOverview = {
  kpis: {
    totalUsers: 12842,
    totalDrivers: 864,
    activeDrivers: 541,
    ongoingRides: 143,
    completedToday: 2187,
    revenueToday: 186540,
    cancelledPercentage: 3.8,
    pendingComplaints: 12,
  },
  ridesPerHour: mockRidesByHour,
  revenueTrend: mockDailyRevenue,
  driverActivityTrend: mockDriverOnlineTrend,
  rideCompletionTrend: mockCancellationTrend,
  zoneDemandHeatmap: mockCityDemand,
  liveAlerts: mockLiveAlerts,
  generatedAt: new Date(now).toISOString(),
};

export const mockAnalytics = {
  ridesByHour: mockRidesByHour,
  dailyRevenue: mockDailyRevenue,
  cityDemand: mockCityDemand,
  cancellationTrend: mockCancellationTrend,
  driverOnlineTrend: mockDriverOnlineTrend,
};

export const mockLiveMap = {
  drivers: mockDrivers
    .filter((driver) => typeof driver.latitude === "number" && typeof driver.longitude === "number")
    .map((driver) => ({
      id: driver.id,
      name: driver.name,
      latitude: driver.latitude,
      longitude: driver.longitude,
      online: driver.online,
      zone: driver.assignedZone,
    })),
  rides: mockRides.items
    .filter((ride) => ["IN_PROGRESS", "ACCEPTED"].includes(String(ride.status || "").toUpperCase()))
    .map((ride, index) => ({
      id: ride.id,
      status: ride.status,
      pickup: ride.pickup,
      destination: ride.destination,
      driverLat: mockDrivers[index % mockDrivers.length]?.latitude || 19.076,
      driverLon: mockDrivers[index % mockDrivers.length]?.longitude || 72.8777,
    })),
  zones: mockCityDemand.map((zone) => ({
    id: zone.zoneId,
    name: zone.zoneName,
    city: zone.city,
    demandLevel: zone.demandLevel,
    activeDrivers: zone.activeDrivers,
    ongoingRides: zone.ongoingRides,
  })),
  sosAlerts: mockComplaintsQueue.items
    .filter((item) => item.category === "SAFETY")
    .slice(0, 3)
    .map((item) => ({
      id: `complaint-${item.id}`,
      title: item.subject,
      severity: item.severity,
      city: item.city,
      createdAt: item.createdAt,
    })),
  generatedAt: new Date(now).toISOString(),
};

export function buildMockDashboardSnapshot() {
  return {
    overview: JSON.parse(JSON.stringify(mockOverview)),
    analytics: JSON.parse(JSON.stringify(mockAnalytics)),
    users: JSON.parse(JSON.stringify(mockUsers)),
    drivers: JSON.parse(JSON.stringify(mockDriverFleet)),
    rides: JSON.parse(JSON.stringify(mockRides)),
    payments: JSON.parse(JSON.stringify(mockPayments)),
    complaints: JSON.parse(JSON.stringify(mockComplaintsQueue)),
    alerts: JSON.parse(JSON.stringify(mockAlerts)),
    settings: JSON.parse(JSON.stringify(mockSettings)),
    pricing: JSON.parse(JSON.stringify(mockPricing)),
    liveMap: JSON.parse(JSON.stringify(mockLiveMap)),
  };
}
