const now = Date.now();
const isoMinutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();
const isoHoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();
const isoDaysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

export const mockLiveAlerts = [
  {
    id: "alert-sos-bkc",
    type: "SOS_ALERT",
    severity: "CRITICAL",
    title: "SOS raised near BKC pickup corridor",
    subtitle: "Rider from Ride #90431 flagged emergency assistance.",
    createdAt: isoMinutesAgo(7),
  },
  {
    id: "alert-fare-drop",
    type: "FARE_DROP",
    severity: "MEDIUM",
    title: "Fare drop triggered in Whitefield",
    subtitle: "Demand dipped for 12 minutes, promo logic engaged.",
    createdAt: isoHoursAgo(6),
  },
  {
    id: "alert-payment-retry",
    type: "PAYMENT_ALERT",
    severity: "LOW",
    title: "Payment retries spiking in Pune East",
    subtitle: "6 card settlements are waiting for bank confirmation.",
    createdAt: isoDaysAgo(2),
  },
];

export const mockAlerts = {
  items: mockLiveAlerts.map((alert) => ({
    ...alert,
    status: "OPEN",
  })),
  total: mockLiveAlerts.length,
};
