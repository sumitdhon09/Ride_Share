import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";
import { formatPaymentModeLabel, paymentStatusMeta } from "../utils/paymentPresentation";

function statusClasses(status) {
  if (status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "CANCELLED") {
    return "bg-rose-100 text-rose-700";
  }
  if (status === "PICKED") {
    return "bg-amber-100 text-amber-700";
  }
  if (status === "ACCEPTED") {
    return "bg-cyan-100 text-cyan-700";
  }
  return "bg-slate-200 text-slate-700";
}

function formatCurrency(value) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
}

export default function RideHistory({
  rides,
  title = "Ride history",
  emptyMessage = "No rides found yet.",
  autoRefresh = true,
  intervalMs = 12000,
}) {
  const hasExternalData = Array.isArray(rides);
  const token = useMemo(() => localStorage.getItem("token") || "", []);

  const [localRides, setLocalRides] = useState([]);
  const [loading, setLoading] = useState(!hasExternalData);
  const [error, setError] = useState("");

  const fetchRides = useCallback(async () => {
    if (hasExternalData || !token) {
      return;
    }

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
    if (!autoRefresh) {
      return;
    }

    const timer = setInterval(fetchRides, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchRides, hasExternalData, intervalMs]);

  const resolvedRides = hasExternalData ? rides : localRides;
  const orderedRides = [...(resolvedRides || [])].sort((left, right) => (right.id || 0) - (left.id || 0));

  if (loading) {
    return (
      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">Loading ride history...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="glass-panel p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      {orderedRides.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Drop</th>
                <th className="px-3 py-2">Fare</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Payment status</th>
              </tr>
            </thead>
            <tbody>
              {orderedRides.map((ride, index) => {
                const paymentMeta = paymentStatusMeta(ride.paymentStatus);

                return (
                <tr key={ride.id || `${ride.pickupLocation}-${ride.dropLocation}-${index}`} className="rounded-2xl bg-white/80 shadow-sm">
                  <td className="rounded-l-2xl px-3 py-3 text-sm font-semibold text-slate-800">{ride.pickupLocation || "-"}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-slate-800">{ride.dropLocation || "-"}</td>
                  <td className="px-3 py-3 text-sm text-slate-700">{formatCurrency(ride.fare)}</td>
                  <td className="px-3 py-3 text-sm">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses(ride.status)}`}>
                      {ride.status || "UNKNOWN"}
                    </span>
                    {ride.status === "CANCELLED" && Number(ride.cancellationFee || 0) > 0 && (
                      <p className="mt-1 text-xs font-semibold text-rose-700">
                        Fee: {formatCurrency(ride.cancellationFee)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {formatPaymentModeLabel(ride.paymentMode)}
                    </span>
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 text-sm text-slate-700">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${paymentMeta.className}`}>
                      {paymentMeta.label}
                    </span>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
