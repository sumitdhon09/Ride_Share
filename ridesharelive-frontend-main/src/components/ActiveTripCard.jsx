import { motion } from "motion/react";
import { CheckCircle2, PhoneCall, Play } from "lucide-react";
import OpsActionButton from "./OpsActionButton";

function TripStep({ label, active, done, isDark }) {
  return (
    <div className="relative flex items-center gap-3">
      <div
        className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
          done || active
            ? "bg-cyan-400 text-slate-950"
            : isDark
              ? "bg-slate-800 text-slate-400"
              : "bg-slate-200 text-slate-500"
        }`}
      >
        {done ? "OK" : ""}
      </div>
      <span className={`text-sm font-medium ${done || active ? (isDark ? "text-slate-100" : "text-slate-900") : "text-slate-500"}`}>
        {label}
      </span>
    </div>
  );
}

export default function ActiveTripCard({
  ride,
  pickupOtp,
  dropOtp,
  onPickupOtpChange,
  onDropOtpChange,
  onMarkPicked,
  onCompleteRide,
  onCallRider,
  busy,
  isDark = true,
}) {
  if (!ride) {
    return (
      <article className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active trip</p>
        <div className={`mt-4 rounded-[1.4rem] border border-dashed p-5 text-sm ${isDark ? "border-slate-700/70 bg-[#0d182b]/78 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          No active trip.
        </div>
      </article>
    );
  }

  const picked = ride.status === "PICKED";

  return (
    <article className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active trip</p>
          <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>
            {ride.pickupLocation} to {ride.dropLocation}
          </h3>
        </div>
        <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-emerald-400/18 bg-emerald-400/[0.08] text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {ride.status}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pickup OTP</p>
              <input
                value={pickupOtp}
                onChange={(event) => onPickupOtpChange(event.target.value)}
                placeholder="Enter pickup OTP"
                className={`mt-3 w-full rounded-xl border px-3 py-3 text-sm outline-none ${isDark ? "border-slate-700/70 bg-[#0d1729] text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
              />
            </div>
            <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Drop OTP</p>
              <input
                value={dropOtp}
                onChange={(event) => onDropOtpChange(event.target.value)}
                placeholder="Enter drop OTP"
                className={`mt-3 w-full rounded-xl border px-3 py-3 text-sm outline-none ${isDark ? "border-slate-700/70 bg-[#0d1729] text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!picked ? (
              <OpsActionButton icon={Play} variant="primary" isDark={isDark} onClick={onMarkPicked} disabled={busy}>
                Start Trip
              </OpsActionButton>
            ) : (
              <OpsActionButton icon={CheckCircle2} variant="success" isDark={isDark} onClick={onCompleteRide} disabled={busy}>
                Complete Trip
              </OpsActionButton>
            )}
            <OpsActionButton icon={PhoneCall} isDark={isDark} onClick={onCallRider}>
              Contact Rider
            </OpsActionButton>
          </div>
        </div>

        <div className={`rounded-[1.4rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trip progress</p>
          <div className="mt-4 space-y-4">
            <TripStep label="Ride accepted" active done isDark={isDark} />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: picked ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
              className="h-1 origin-left rounded-full bg-gradient-to-r from-cyan-400 to-lime-400"
            />
            <TripStep label="Pickup verified" active={Boolean(pickupOtp)} done={picked} isDark={isDark} />
            <TripStep label="Trip in progress" active={picked} done={picked} isDark={isDark} />
            <TripStep label="Drop verified" active={Boolean(dropOtp)} done={false} isDark={isDark} />
          </div>
        </div>
      </div>
    </article>
  );
}
