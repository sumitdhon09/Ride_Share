const PAYMENT_RETURN_STATE_STORAGE_KEY = "paymentReturnState:v1";

function normalizeState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return null;
  }

  const status = String(rawState.status || "").trim().toLowerCase();
  const title = String(rawState.title || "").trim();
  const message = String(rawState.message || "").trim();
  const tone = String(rawState.tone || "").trim().toLowerCase() || "info";
  const actionLabel = String(rawState.actionLabel || "").trim();
  const sessionId = String(rawState.sessionId || "").trim();

  if (!status || !title || !message) {
    return null;
  }

  return {
    status,
    title,
    message,
    tone,
    actionLabel,
    sessionId,
    createdAt: String(rawState.createdAt || new Date().toISOString()),
  };
}

function emitState(state) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("rideshare:payment-return-state", {
      detail: state,
    })
  );
}

export function readPaymentReturnState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(PAYMENT_RETURN_STATE_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

export function persistPaymentReturnState(state) {
  const normalized = normalizeState(state);
  if (!normalized) {
    return null;
  }

  localStorage.setItem(PAYMENT_RETURN_STATE_STORAGE_KEY, JSON.stringify(normalized));
  emitState(normalized);
  return normalized;
}

export function clearPaymentReturnState() {
  localStorage.removeItem(PAYMENT_RETURN_STATE_STORAGE_KEY);
  emitState(null);
}
