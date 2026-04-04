import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, MapPin, Wallet, XCircle } from "lucide-react";
import OpsActionButton from "./OpsActionButton";

export default function RideRequestCard({ request, onAccept, onReject, accepting, disabled, isDark = true }) {
  if (!request) {
    return (
      <article className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Incoming request</p>
        <div className={`mt-4 rounded-[1.4rem] border border-dashed p-5 text-sm ${isDark ? "border-slate-700/70 bg-[#0d182b]/78 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          No request in queue.
        </div>
      </article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0, boxShadow: ["0 0 0 rgba(34,211,238,0)", "0 0 0 1px rgba(34,211,238,0.18)", "0 0 0 rgba(34,211,238,0)"] }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], boxShadow: { duration: 1.8, repeat: Infinity } }}
      className={`rounded-[1.75rem] border p-5 ${isDark ? "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(6,13,25,0.96),rgba(9,18,34,0.92))]" : "border-sky-200 bg-white/96"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Incoming request</p>
          <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>{request.riderName || "Rider nearby"}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
          New
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pickup</p>
          <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            <MapPin className={`h-4 w-4 ${isDark ? "text-cyan-300" : "text-sky-500"}`} aria-hidden="true" />
            <span>{request.pickupLocation}</span>
          </p>
        </div>
        <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Drop</p>
          <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            <ArrowRight className={`h-4 w-4 ${isDark ? "text-cyan-300" : "text-sky-500"}`} aria-hidden="true" />
            <span>{request.dropLocation}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-[1.2rem] px-4 py-3 ${isDark ? "border border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Distance</p>
          <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{request.distanceKm || 6} km</p>
        </div>
        <div className={`rounded-[1.2rem] px-4 py-3 ${isDark ? "border border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Fare</p>
          <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>INR {request.fare}</p>
        </div>
        <div className={`rounded-[1.2rem] px-4 py-3 ${isDark ? "border border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pay</p>
          <p className={`mt-1 flex items-center gap-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            <Wallet className={`h-4 w-4 ${isDark ? "text-cyan-300" : "text-sky-500"}`} aria-hidden="true" />
            <span>{request.paymentMode}</span>
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <OpsActionButton
          icon={CheckCircle2}
          variant="primary"
          isDark={isDark}
          onClick={onAccept}
          disabled={accepting || disabled}
        >
          {accepting ? "Accepting..." : "Accept Ride"}
        </OpsActionButton>
        <OpsActionButton
          icon={XCircle}
          variant="danger"
          isDark={isDark}
          onClick={onReject}
        >
          Reject
        </OpsActionButton>
      </div>
    </motion.article>
  );
}
