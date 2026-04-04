import { motion } from "motion/react";
import { Activity, LocateFixed, RefreshCcw } from "lucide-react";
import { useState } from "react";
import CompactMap from "./CompactMap";
import OpsActionButton from "./OpsActionButton";

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
      <section className={`rounded-[1.75rem] border p-4 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Live map</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OpsActionButton compact icon={LocateFixed} variant="primary" isDark={isDark} onClick={onCenterToUser}>
              Center
            </OpsActionButton>
            <OpsActionButton compact icon={RefreshCcw} isDark={isDark} onClick={onRefresh}>
              Refresh
            </OpsActionButton>
            <OpsActionButton compact icon={Activity} variant="warning" isDark={isDark} onClick={() => setActivityOpen(true)}>
              Activity
            </OpsActionButton>
            {["High demand", "Nearby riders"].map((chip) => (
              <span key={chip} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-slate-700/70 bg-[#0f1a2d] text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
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
              isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.98),rgba(9,18,34,0.95))] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Driver activity</h3>
              <OpsActionButton compact isDark={isDark} onClick={() => setActivityOpen(false)}>
                Close
              </OpsActionButton>
            </div>
            <div className={`mt-4 space-y-3 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Last accepted</span><span>2 min ago</span></div></div>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Demand spike</span><span>Station Road</span></div></div>
              <div className={`rounded-[1.1rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between"><span>Next best zone</span><span>Bus Stand</span></div></div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
