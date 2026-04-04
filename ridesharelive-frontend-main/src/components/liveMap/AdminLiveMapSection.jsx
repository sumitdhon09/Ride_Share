import { memo, useMemo } from "react";
import LiveRideMapCard from "../LiveRideMapCard";
import PaymentSummaryCard from "../PaymentSummaryCard";

function SectionCard({ title, eyebrow, children, isDark }) {
  return (
    <section
      className={`rounded-[1.75rem] border p-5 ${
        isDark
          ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]"
          : "border-slate-200 bg-white/96"
      }`}
    >
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{eyebrow}</p>
        <h3 className={`mt-2 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AdminLiveMapSection({ mapData, paymentMetrics, isDark = true, connectionLabel = "Live" }) {
  const hotspots = useMemo(
    () =>
      (mapData?.zones || [])
        .slice()
        .sort((left, right) => Number(right.ongoingRides || 0) - Number(left.ongoingRides || 0))
        .slice(0, 4),
    [mapData?.zones]
  );

  return (
    <div className="grid gap-5">
      <LiveRideMapCard mapData={mapData} isDark={isDark} />
      <PaymentSummaryCard metrics={paymentMetrics} isDark={isDark} />
      <SectionCard title="Demand hotspots" eyebrow={connectionLabel} isDark={isDark}>
        <div className="grid gap-3">
          {hotspots.map((zone) => (
            <div
              key={zone.id}
              className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 ${
                isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div>
                <p className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>{zone.name}</p>
                <p className="mt-1 text-sm text-slate-500">{zone.city}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${isDark ? "text-cyan-200" : "text-sky-700"}`}>{zone.ongoingRides} rides</p>
                <p className="mt-1 text-xs text-slate-500">{zone.activeDrivers} drivers online</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default memo(AdminLiveMapSection);
