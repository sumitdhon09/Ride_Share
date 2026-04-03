import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api.jsx";
import { formatPaymentModeLabel, paymentStatusMeta } from "../utils/paymentPresentation";

function statusClasses(status) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  if (status === "PICKED") return "bg-amber-100 text-amber-700";
  if (status === "ACCEPTED") return "bg-cyan-100 text-cyan-700";
  return "bg-slate-200 text-slate-700";
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
}) {
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
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        {showLoading ? <p className="mt-2 text-sm text-slate-500">Loading activity...</p> : null}
        {error ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      </div>

      {!showLoading && !error && orderedRides.length === 0 ? (
        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        {showLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <article
                key={`ride-skeleton-${index}`}
                className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4"
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
              className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClasses(rideStatus)}`}>
                      {rideStatus}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{formatRideTime(ride)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ride?.pickupLocation || "-"}</p>
                    <p className="mt-1 text-sm text-slate-500">{ride?.dropLocation || "-"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-950">{formatCurrency(ride?.fare)}</p>
                  {rideStatus === "CANCELLED" && Number(ride?.cancellationFee || 0) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-rose-700">Fee: {formatCurrency(ride.cancellationFee)}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {formatPaymentModeLabel(ride?.paymentMode)}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentMeta?.className || "bg-slate-200 text-slate-700"}`}>
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
