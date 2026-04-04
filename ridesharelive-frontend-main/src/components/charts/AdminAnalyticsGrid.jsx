import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function AdminAnalyticsGrid({ analytics, isDark = true, formatCurrency }) {
  const axisStroke = useMemo(() => (isDark ? "#94a3b8" : "#64748b"), [isDark]);
  const gridStroke = useMemo(() => (isDark ? "#1e293b" : "#e2e8f0"), [isDark]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="Daily revenue" eyebrow="Analytics" isDark={isDark}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analytics?.dailyRevenue || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="label" stroke={axisStroke} />
            <YAxis stroke={axisStroke} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Area isAnimationActive={false} type="monotone" dataKey="value" stroke="#22d3ee" fill="#0f766e33" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Cancellation trend" eyebrow="Analytics" isDark={isDark}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={analytics?.cancellationTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="label" stroke={axisStroke} />
            <YAxis stroke={axisStroke} />
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend />
            <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="Driver online trend" eyebrow="Analytics" isDark={isDark}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analytics?.driverOnlineTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="label" stroke={axisStroke} />
            <YAxis stroke={axisStroke} />
            <Tooltip />
            <Bar isAnimationActive={false} dataKey="value" fill="#34d399" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="City demand heatmap" eyebrow="Analytics" isDark={isDark}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={analytics?.cityDemand || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="zoneName" stroke={axisStroke} />
            <YAxis stroke={axisStroke} />
            <Tooltip />
            <Bar isAnimationActive={false} dataKey="ongoingRides" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="activeDrivers" fill="#fbbf24" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

export default memo(AdminAnalyticsGrid);
