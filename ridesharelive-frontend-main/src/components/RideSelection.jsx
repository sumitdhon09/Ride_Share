import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

function formatCurrency(value) {
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(Number(distanceKm)) || Number(distanceKm) <= 0) {
    return null;
  }
  const rounded = Number(distanceKm);
  return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
}

export default function RideSelection({
  rides,
  selectedRide,
  onSelect,
  roundTripEnabled,
  onToggleRoundTrip,
  fareEstimate,
  distanceKm,
}) {
  const [draggingRideId, setDraggingRideId] = useState(null);
  const currentRide = rides.find((ride) => ride.id === selectedRide) || rides[0] || null;
  const distanceText = formatDistance(distanceKm);

  const handleCardSwipe = (rideId, offsetX) => {
    const rideIndex = rides.findIndex((ride) => ride.id === rideId);
    if (rideIndex === -1) {
      return;
    }
    if (offsetX <= -90 && rides[rideIndex + 1]) {
      onSelect(rides[rideIndex + 1].id);
      return;
    }
    if (offsetX >= 90 && rides[rideIndex - 1]) {
      onSelect(rides[rideIndex - 1].id);
      return;
    }
    onSelect(rideId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-950">Choose a ride</h3>
        </div>

        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.16)]">
          <button
            type="button"
            onClick={() => onToggleRoundTrip?.(false)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              !roundTripEnabled ? "bg-slate-950 text-white" : "text-slate-600"
            }`}
          >
            One way
          </button>
          <button
            type="button"
            onClick={() => onToggleRoundTrip?.(true)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              roundTripEnabled ? "bg-slate-950 text-white" : "text-slate-600"
            }`}
          >
            Round trip
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rides.map((ride) => {
          const selected = ride.id === selectedRide;
          const meta = `${ride.eta}${ride.seats ? ` • ${ride.seats} seats` : ""}`;

          return (
            <motion.button
              key={ride.id}
              type="button"
              layout
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              dragMomentum={false}
              onDragStart={() => setDraggingRideId(ride.id)}
              onDragEnd={(_, info) => {
                setDraggingRideId(null);
                handleCardSwipe(ride.id, info.offset.x);
              }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ y: -1, scale: 0.995 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onSelect(ride.id)}
              className={`flex min-h-[188px] flex-col rounded-[1.5rem] border px-5 py-5 text-left transition ${
                selected
                  ? "border-cyan-400 bg-slate-950 text-white shadow-[0_24px_48px_-28px_rgba(8,145,178,0.38)]"
                  : "border-slate-200 bg-white text-slate-900 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.14)] hover:border-slate-300 hover:shadow-[0_22px_42px_-28px_rgba(15,23,42,0.18)]"
              } ${
                draggingRideId === ride.id
                  ? selected
                    ? "ring-2 ring-cyan-300/60 shadow-[0_28px_54px_-24px_rgba(8,145,178,0.5)]"
                    : "border-cyan-200 bg-cyan-50/60 ring-2 ring-cyan-200 shadow-[0_24px_42px_-24px_rgba(8,145,178,0.2)]"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[11px] font-bold uppercase tracking-[0.14em] ${
                      selected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ride.icon}
                  </span>
                  <div>
                    <p className="text-lg font-semibold tracking-tight">{ride.name}</p>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {selected ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/18 text-sm font-bold text-cyan-200"
                    >
                      ✓
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
              <div className="mt-auto pt-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={`${ride.id}-${ride.price}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="text-3xl font-bold tracking-tight"
                  >
                    {formatCurrency(ride.price)}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        layout
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        whileHover={{ y: -2, boxShadow: "0 22px 38px -28px rgba(15,23,42,0.18)" }}
        className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.12)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current total</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-950">
              {currentRide?.name || "Ride"}
              {distanceText ? ` • ${distanceText}` : ""}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${currentRide?.id || "ride"}-${fareEstimate || 0}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="text-right"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(fareEstimate || 0)}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
