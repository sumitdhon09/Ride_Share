import { memo } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import OpsActionButton from "./OpsActionButton";

function DriverApprovalTable({
  rows,
  onApprove,
  onReject,
  onViewKyc,
  isDark = true,
  loading = false,
  emptyLabel = "No pending approvals",
}) {
  return (
    <section className={`rounded-[1.75rem] border p-5 ${
      isDark
        ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]"
        : "border-slate-200 bg-white/96"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Driver approvals</p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isDark ? "border border-slate-700/70 bg-[#0f1a2d] text-slate-300" : "bg-slate-100 text-slate-700"}`}>{rows.length} pending</span>
      </div>
      <div className={`mt-4 overflow-hidden rounded-[1.2rem] border ${isDark ? "border-[rgba(41,56,83,0.82)]" : "border-slate-200"}`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y text-sm ${isDark ? "divide-[rgba(41,56,83,0.82)]" : "divide-slate-200"}`}>
            <thead className={isDark ? "bg-[#0d182b]/86 text-left text-slate-400" : "bg-slate-50 text-left text-slate-500"}>
              <tr>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">KYC</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className={isDark ? "divide-y divide-[rgba(41,56,83,0.82)] text-slate-200" : "divide-y divide-slate-200 text-slate-700"}>
              {loading ? (
                [...Array.from({ length: 4 })].map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className={`h-10 animate-pulse rounded-xl ${isDark ? "bg-[#0d182b]" : "bg-slate-100"}`} />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={`transition ${isDark ? "hover:bg-[#101b2f]/82" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.city || "-"}</td>
                    <td className="px-4 py-3">{row.vehicleLabel || "-"}</td>
                    <td className="px-4 py-3">{row.kycStatus || "Pending"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <OpsActionButton compact icon={Eye} isDark={isDark} onClick={() => onViewKyc?.(row)}>
                          View KYC
                        </OpsActionButton>
                        <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => onApprove?.(row)}>
                          Approve
                        </OpsActionButton>
                        <OpsActionButton compact icon={XCircle} variant="danger" isDark={isDark} onClick={() => onReject?.(row)}>
                          Reject
                        </OpsActionButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default memo(DriverApprovalTable);
