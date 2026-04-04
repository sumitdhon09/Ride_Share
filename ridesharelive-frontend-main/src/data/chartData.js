const now = Date.now();
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const mockRidesByHour = [
  { label: "06:00", value: 36 },
  { label: "08:00", value: 72 },
  { label: "09:00", value: 141 },
  { label: "11:00", value: 158 },
  { label: "13:00", value: 116 },
  { label: "15:00", value: 104 },
  { label: "18:00", value: 169 },
  { label: "20:00", value: 151 },
  { label: "22:00", value: 84 },
];

export const mockDailyRevenue = [
  { label: "Mon", value: 142300 },
  { label: "Tue", value: 149850 },
  { label: "Wed", value: 156420 },
  { label: "Thu", value: 164200 },
  { label: "Fri", value: 178940 },
  { label: "Sat", value: 198640 },
  { label: "Sun", value: 191320 },
];

export const mockDriverOnlineTrend = [
  { label: "06:00", value: 224 },
  { label: "08:00", value: 341 },
  { label: "10:00", value: 486 },
  { label: "12:00", value: 512 },
  { label: "14:00", value: 466 },
  { label: "18:00", value: 554 },
  { label: "20:00", value: 529 },
  { label: "22:00", value: 381 },
];

export const mockCancellationTrend = days.map((label, index) => ({
  label,
  value: [4.3, 4.1, 3.9, 3.7, 3.8, 3.4, 3.6][index],
}));

export const mockCityDemand = [
  { zoneId: 1, zoneName: "BKC", city: "Mumbai", demandLevel: "HIGH", activeDrivers: 122, ongoingRides: 34 },
  { zoneId: 2, zoneName: "Whitefield", city: "Bengaluru", demandLevel: "HIGH", activeDrivers: 108, ongoingRides: 31 },
  { zoneId: 3, zoneName: "Cyber City", city: "Gurugram", demandLevel: "MEDIUM", activeDrivers: 94, ongoingRides: 22 },
  { zoneId: 4, zoneName: "Hinjewadi", city: "Pune", demandLevel: "MEDIUM", activeDrivers: 79, ongoingRides: 19 },
  { zoneId: 5, zoneName: "Gachibowli", city: "Hyderabad", demandLevel: "ELEVATED", activeDrivers: 86, ongoingRides: 24 },
];

export const mockHotspots = [
  { id: "hotspot-bkc", city: "Mumbai", label: "BKC", rides: 34, intensity: 0.96, updatedAt: new Date(now - 9 * 60 * 1000).toISOString() },
  { id: "hotspot-whitefield", city: "Bengaluru", label: "Whitefield", rides: 31, intensity: 0.9, updatedAt: new Date(now - 14 * 60 * 1000).toISOString() },
  { id: "hotspot-cyber-city", city: "Gurugram", label: "Cyber City", rides: 22, intensity: 0.74, updatedAt: new Date(now - 21 * 60 * 1000).toISOString() },
];
