import { useMemo, useState } from "react";
import { apiRequest } from "../api";

function getFeedbackKeys(userRole) {
  if (userRole === "DRIVER") {
    return { ratingKey: "driverRating", commentKey: "driverFeedback" };
  }
  return { ratingKey: "riderRating", commentKey: "riderFeedback" };
}

function isServerRideId(rideId) {
  if (typeof rideId === "number") {
    return Number.isFinite(rideId);
  }
  return /^\d+$/.test(String(rideId || "").trim());
}

export default function RideFeedbackPanel({
  rides = [],
  userRole = "RIDER",
  title = "Ride feedback",
  onRidePatched,
}) {
  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const { ratingKey, commentKey } = getFeedbackKeys(userRole);

  const pendingRides = useMemo(
    () =>
      (rides || []).filter((ride) => {
        if (ride?.status !== "COMPLETED") {
          return false;
        }
        const existingRating = Number(ride?.[ratingKey]);
        const hasComment = Boolean((ride?.[commentKey] || "").trim());
        return !existingRating && !hasComment;
      }),
    [commentKey, ratingKey, rides]
  );

  const [drafts, setDrafts] = useState({});
  const [loadingRideId, setLoadingRideId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateDraft = (rideId, patch) => {
    setDrafts((previous) => ({
      ...previous,
      [rideId]: {
        rating: previous?.[rideId]?.rating || 5,
        comment: previous?.[rideId]?.comment || "",
        ...patch,
      },
    }));
  };

  const submitFeedback = async (ride) => {
    if (!ride?.id) {
      return;
    }
    setError("");
    setSuccess("");

    const draft = drafts[ride.id] || { rating: 5, comment: "" };
    const rating = Number(draft.rating) || 5;
    const comment = (draft.comment || "").trim();
    if (rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5.");
      return;
    }

    setLoadingRideId(ride.id);
    try {
      if (isServerRideId(ride.id)) {
        const updatedRide = await apiRequest(
          `/rides/feedback/${ride.id}`,
          "POST",
          { rating, comment },
          token
        );
        onRidePatched?.(ride.id, {
          [ratingKey]: updatedRide?.[ratingKey] ?? rating,
          [commentKey]: updatedRide?.[commentKey] ?? comment,
        });
      } else {
        onRidePatched?.(ride.id, {
          [ratingKey]: rating,
          [commentKey]: comment,
        });
      }

      setSuccess("Feedback submitted.");
    } catch (requestError) {
      setError(requestError.message || "Unable to submit feedback.");
    } finally {
      setLoadingRideId(null);
    }
  };

  if (pendingRides.length === 0) {
    return null;
  }

  return (
    <section className="glass-panel p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">Rate completed rides and leave feedback.</p>

      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {pendingRides.map((ride) => {
          const draft = drafts[ride.id] || { rating: 5, comment: "" };
          const isSubmitting = loadingRideId === ride.id;

          return (
            <article key={ride.id} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {ride.pickupLocation || "-"} to {ride.dropLocation || "-"}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[180px,1fr]">
                <div>
                  <label htmlFor={`rating-${ride.id}`} className="mb-1 block text-sm font-semibold text-slate-700">
                    Rating
                  </label>
                  <select
                    id={`rating-${ride.id}`}
                    value={draft.rating}
                    onChange={(event) => updateDraft(ride.id, { rating: Number(event.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value={5}>5 - Excellent</option>
                    <option value={4}>4 - Good</option>
                    <option value={3}>3 - Average</option>
                    <option value={2}>2 - Poor</option>
                    <option value={1}>1 - Bad</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`comment-${ride.id}`} className="mb-1 block text-sm font-semibold text-slate-700">
                    Feedback
                  </label>
                  <textarea
                    id={`comment-${ride.id}`}
                    rows={2}
                    value={draft.comment}
                    onChange={(event) => updateDraft(ride.id, { comment: event.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    placeholder="Write your feedback"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => submitFeedback(ride)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit feedback"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
