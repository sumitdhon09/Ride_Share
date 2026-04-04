import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api.jsx";
import { formatPaymentModeLabel, paymentStatusMeta } from "../utils/paymentPresentation";

function statusClasses(status, isDarkTheme) {
  if (status === "COMPLETED") return isDarkTheme ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return isDarkTheme ? "bg-rose-400/15 text-rose-200" : "bg-rose-100 text-rose-700";
  if (status === "PICKED") return isDarkTheme ? "bg-amber-400/15 text-amber-200" : "bg-amber-100 text-amber-700";
  if (status === "ACCEPTED") return isDarkTheme ? "bg-cyan-400/15 text-cyan-200" : "bg-cyan-100 text-cyan-700";
  return isDarkTheme ? "bg-white/[0.08] text-slate-300" : "bg-slate-200 text-slate-700";
}

function paymentStatusClasses(paymentStatus, isDarkTheme) {
  if (!isDarkTheme) {
    return paymentStatusMeta(paymentStatus).className;
  }

  const normalized = String(paymentStatus || "").trim().toUpperCase();
  if (normalized === "PAID") return "bg-emerald-400/15 text-emerald-200";
  if (normalized === "PENDING") return "bg-amber-400/15 text-amber-200";
  if (normalized === "FAILED") return "bg-rose-400/15 text-rose-200";
  return "bg-white/[0.08] text-slate-300";
}

function formatCurrency(value) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
}

function formatRideTime(ride) {
  const raw = ride?.createdAt || ride?.bookedAt || ride?.requestedAt;
  if (!raw) return "Recent";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RideHistory({
  rides = [],
  title = "Ride history",
  emptyMessage = "No rides found yet.",
  autoRefresh = true,
  intervalMs = 12000,
  loadingOverride = false,
  theme = "light",
}) {
  const isDarkTheme = theme === "dark";
  const hasExternalData = Array.isArray(rides);
  const token = localStorage.getItem("token") || "";
  const [localRides, setLocalRides] = useState([]);
  const [loading, setLoading] = useState(!hasExternalData);
  const [error, setError] = useState("");

  const fetchRides = useCallback(async () => {
    if (hasExternalData || !token) return;

    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/rides/history", "GET", null, token);
      setLocalRides(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load ride history.");
    } finally {
      setLoading(false);
    }
  }, [hasExternalData, token]);

  useEffect(() => {
    if (hasExternalData) {
      setLoading(false);
      return;
    }

    fetchRides();
    if (!autoRefresh) return;

    const timer = setInterval(fetchRides, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchRides, hasExternalData, intervalMs]);

  const resolvedRides = hasExternalData ? rides : localRides;
  const showLoading = hasExternalData ? loadingOverride : loading;
  const safeRides = Array.isArray(resolvedRides) ? resolvedRides : [];
  const orderedRides = [...safeRides].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || left?.bookedAt || left?.requestedAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || right?.bookedAt || right?.requestedAt || 0).getTime();
    return rightTime - leftTime;
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className={`text-xl font-bold ${isDarkTheme ? "text-slate-50" : "text-slate-950"}`}>{title}</h2>
        {showLoading ? <p className={`mt-2 text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>Loading activity...</p> : null}
        {error ? (
          <p className={`mt-2 rounded-xl border px-3 py-2 text-sm ${isDarkTheme ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-600"}`}>
            {error}
          </p>
        ) : null}
      </div>

      {!showLoading && !error && orderedRides.length === 0 ? (
        <div className={`rounded-[1.4rem] border px-4 py-6 text-sm ${isDarkTheme ? "border-white/10 bg-white/[0.06] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {emptyMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        {showLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <article
                key={`ride-skeleton-${index}`}
                className={`rounded-[1.4rem] border p-4 ${isDarkTheme ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-slate-50/80"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="w-full max-w-[18rem] space-y-2">
                    <div className="loading-shimmer h-5 w-24 rounded-full" />
                    <div className="loading-shimmer h-4 w-full rounded-lg" />
                    <div className="loading-shimmer h-4 w-4/5 rounded-lg" />
                  </div>
                  <div className="w-24 space-y-2">
                    <div className="loading-shimmer h-5 w-full rounded-lg" />
                    <div className="loading-shimmer ml-auto h-4 w-14 rounded-lg" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="loading-shimmer h-7 w-24 rounded-full" />
                  <div className="loading-shimmer h-7 w-20 rounded-full" />
                </div>
              </article>
            ))
          : null}
        {orderedRides.map((ride, index) => {
          const paymentMeta = paymentStatusMeta(ride?.paymentStatus);
          const rideStatus = String(ride?.status || "UNKNOWN").toUpperCase();

          return (
            <article
              key={ride?.id || `${ride?.pickupLocation || "pickup"}-${ride?.dropLocation || "drop"}-${index}`}
              className={`rounded-[1.4rem] border p-4 ${isDarkTheme ? "border-white/10 bg-white/[0.06]" : "border-slate-200 bg-slate-50/80"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClasses(rideStatus, isDarkTheme)}`}>
                      {rideStatus}
                    </span>
                    <span className={`text-xs font-medium ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>{formatRideTime(ride)}</span>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{ride?.pickupLocation || "-"}</p>
                    <p className={`mt-1 text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>{ride?.dropLocation || "-"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${isDarkTheme ? "text-slate-50" : "text-slate-950"}`}>{formatCurrency(ride?.fare)}</p>
                  {rideStatus === "CANCELLED" && Number(ride?.cancellationFee || 0) > 0 ? (
                    <p className={`mt-1 text-xs font-semibold ${isDarkTheme ? "text-rose-200" : "text-rose-700"}`}>Fee: {formatCurrency(ride.cancellationFee)}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isDarkTheme ? "bg-white/[0.06] text-slate-200 ring-1 ring-white/10" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                  {formatPaymentModeLabel(ride?.paymentMode)}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusClasses(ride?.paymentStatus, isDarkTheme)}`}>
                  {paymentMeta?.label || "-"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
