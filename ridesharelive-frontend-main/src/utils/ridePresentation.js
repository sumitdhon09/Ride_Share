const BOOKING_CONFIRMATION_STORAGE_PREFIX = "rideBookingConfirmation:";

export function formatInr(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatRideTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function calculateCancellationFeePreview(ride, cancelledBy = "RIDER") {
  if (String(cancelledBy || "").trim().toUpperCase() === "DRIVER") {
    return 0;
  }

  const status = String(ride?.status || "").trim().toUpperCase();
  const fare = Math.max(0, Number(ride?.fare) || 0);

  if (status === "REQUESTED") {
    return 0;
  }
  if (status === "ACCEPTED") {
    return Math.min(60, Math.max(20, fare * 0.2));
  }
  if (status === "PICKED") {
    return Math.min(180, Math.max(50, fare * 0.4));
  }
  return 0;
}

export function persistRideBookingConfirmation(ride, confirmation) {
  const rideId = ride?.id;
  if (!rideId) {
    return;
  }

  localStorage.setItem(
    `${BOOKING_CONFIRMATION_STORAGE_PREFIX}${rideId}`,
    JSON.stringify({
      rideId: String(rideId),
      paymentMode: String(confirmation?.paymentMode || ride?.paymentMode || "").trim().toUpperCase(),
      paymentStatus: String(confirmation?.paymentStatus || ride?.paymentStatus || "").trim().toUpperCase(),
      rideTypeLabel: String(confirmation?.rideTypeLabel || "").trim(),
      etaText: String(confirmation?.etaText || "").trim(),
      preferredDriverName: String(confirmation?.preferredDriverName || "").trim(),
      requestedAt: String(ride?.createdAt || confirmation?.requestedAt || new Date().toISOString()),
      savedAt: new Date().toISOString(),
    })
  );
}

export function readRideBookingConfirmation(rideId) {
  if (!rideId) {
    return null;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(`${BOOKING_CONFIRMATION_STORAGE_PREFIX}${rideId}`) || "null");
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      rideId: String(parsed.rideId || ""),
      paymentMode: String(parsed.paymentMode || "").trim().toUpperCase(),
      paymentStatus: String(parsed.paymentStatus || "").trim().toUpperCase(),
      rideTypeLabel: String(parsed.rideTypeLabel || "").trim(),
      etaText: String(parsed.etaText || "").trim(),
      preferredDriverName: String(parsed.preferredDriverName || "").trim(),
      requestedAt: String(parsed.requestedAt || ""),
      savedAt: String(parsed.savedAt || ""),
    };
  } catch {
    return null;
  }
}

export function clearRideBookingConfirmation(rideId) {
  if (!rideId) {
    return;
  }
  localStorage.removeItem(`${BOOKING_CONFIRMATION_STORAGE_PREFIX}${rideId}`);
}
