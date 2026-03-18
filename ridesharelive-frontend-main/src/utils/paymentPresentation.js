export function formatPaymentModeLabel(paymentMode) {
  const normalized = String(paymentMode || "").trim().toUpperCase();

  if (normalized === "CASH") {
    return "Cash";
  }
  if (normalized === "CARD") {
    return "Card";
  }
  if (normalized === "UPI") {
    return "UPI";
  }

  return normalized || "-";
}

export function paymentStatusMeta(paymentStatus) {
  const normalized = String(paymentStatus || "").trim().toUpperCase();

  if (normalized === "PAID") {
    return {
      label: "Paid",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (normalized === "PENDING") {
    return {
      label: "Pending",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (normalized === "FAILED") {
    return {
      label: "Failed",
      className: "bg-rose-100 text-rose-700",
    };
  }

  return {
    label: normalized || "-",
    className: "bg-slate-200 text-slate-700",
  };
}
