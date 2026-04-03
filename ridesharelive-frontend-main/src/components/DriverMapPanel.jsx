import { motion } from "motion/react";
import { useState } from "react";
import CompactMap from "./CompactMap";

export default function DriverMapPanel({
  pickup,
  drop,
  pickupCoordinate,
  dropCoordinate,
  currentLocation,
  onCenterToUser,
  onRefresh,
  isDark = true,
}) {
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <>
      <section className={`rounded-[1.75rem] border p-4 ${isDark ? "border-slate-800 bg-slate-950/92" : "border-slate-200 bg-white/96"}`}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Live map</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCenterToUser}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" : "border-sky-200 bg-sky-50 text-sky-700"}`}
            >
              Center
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-violet-400/20 bg-violet-400/10 text-violet-200" : "border-violet-200 bg-violet-50 text-violet-700"}`}
            >
              Activity
            </button>
            {["High demand", "Nearby riders"].map((chip) => (
              <span key={chip} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      <div className="relative">
        <CompactMap
          pickup={pickup}
          drop={drop}
          pickupCoordinate={pickupCoordinate}
          dropCoordinate={dropCoordinate}
          currentLocation={currentLocation}
          onCenterToUser={onCenterToUser}
          theme={isDark ? "dark" : "light"}
          heightClass="h-[320px] xl:h-[420px]"
        />
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid gap-2">
          {["Zone A - Surge", "Zone B - Steady", "Zone C - Quiet"].map((zone, index) => (
            <motion.div
              key={zone}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur ${isDark ? "border-white/10 bg-slate-950/70 text-slate-200" : "border-white/50 bg-white/80 text-slate-700"}`}
            >
              {zone}
            </motion.div>
          ))}
        </div>
      </div>
      </section>
      {activityOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/40 p-4 backdrop-blur-[2px]" onClick={() => setActivityOpen(false)}>
          <div
            className={`mt-20 w-full max-w-sm rounded-[1.6rem] border p-5 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.45)] ${
              isDark ? "border-slate-800 bg-slate-950/98 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Driver activity</h3>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
              >
                Close
              </button>
            </div>
            <div className={`mt-4 space-y-3 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Last accepted</span><span>2 min ago</span></div></div>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Demand spike</span><span>Station Road</span></div></div>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Next best zone</span><span>Bus Stand</span></div></div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
