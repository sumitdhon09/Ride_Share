function formatMultiplier(value) {
  const numeric = Number(value) || 1;
  return numeric >= 1.1 ? numeric.toFixed(2) : numeric.toFixed(1);
}

export default function PredictiveInsightsPanel({ insights, loading = false }) {
  if (loading && !insights) {
    return (
      <section className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
        <div className="animate-pulse">
          <div className="h-4 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 h-8 w-64 rounded-full bg-slate-200" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="mt-3 h-8 w-20 rounded-full bg-slate-200" />
                <div className="mt-4 h-3 w-full rounded-full bg-slate-100" />
                <div className="mt-2 h-3 w-5/6 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!insights) {
    return (
      <section className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Predictive ops</h2>
        <p className="mt-2 text-sm text-slate-600">Forecasting is unavailable until ride analytics data loads.</p>
      </section>
    );
  }

  const demand = insights.demandForecast || {};
  const surge = insights.surgeRecommendation || {};
  const eta = insights.etaGuidance || {};
  const supply = insights.driverSupplyPlan || {};

  return (
    <section className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Predictive ops</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">Demand forecast and marketplace pressure</h2>
          <p className="mt-2 text-sm text-slate-600">
            Forecasted from ride history, current open demand, and active driver coverage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
            {insights.confidence || "LOW"} confidence
          </span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">
            Sample size {insights.sampleSize || 0}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[26px] border border-cyan-200 bg-cyan-50/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Demand forecast</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-slate-900">{demand.nextHourDemand || 0}</p>
              <p className="text-sm font-semibold text-slate-600">next hour rides</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-700">
              {demand.trend || "STABLE"}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <dt>Next 2 hours</dt>
              <dd className="font-semibold text-slate-900">{demand.nextTwoHoursDemand || 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Open requests</dt>
              <dd className="font-semibold text-slate-900">{demand.currentOpenRequests || 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Peak window</dt>
              <dd className="font-semibold text-slate-900">{demand.peakWindow || "-"}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-[26px] border border-amber-200 bg-amber-50/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Surge suggestion</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-slate-900">x{formatMultiplier(surge.suggestedMultiplier)}</p>
              <p className="text-sm font-semibold text-slate-600">suggested multiplier</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700">
              {surge.intensity || "NORMAL"}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{surge.reason || "No surge action needed."}</p>
        </article>

        <article className="rounded-[26px] border border-violet-200 bg-violet-50/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">ETA pressure</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-slate-900">{eta.predictedPickupMinutes || 0} min</p>
              <p className="text-sm font-semibold text-slate-600">predicted pickup</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700">
              +{eta.deltaMinutes || 0} min
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <dt>Baseline</dt>
              <dd className="font-semibold text-slate-900">{eta.baselinePickupMinutes || 0} min</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-slate-700">{eta.reason || "Pickup timing is stable."}</p>
        </article>

        <article className="rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Driver supply plan</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-slate-900">{supply.recommendedOnlineDrivers || 0}</p>
              <p className="text-sm font-semibold text-slate-600">drivers recommended online</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
              Gap {supply.additionalDriversNeeded || 0}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <dt>Active estimate</dt>
              <dd className="font-semibold text-slate-900">{supply.activeDriversEstimate || 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Busy now</dt>
              <dd className="font-semibold text-slate-900">{supply.busyDrivers || 0}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-slate-700">{supply.action || "No action needed."}</p>
        </article>
      </div>
    </section>
  );
}
