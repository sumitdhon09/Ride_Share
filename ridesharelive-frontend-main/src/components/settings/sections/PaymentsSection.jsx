import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CreditCard, Receipt, TicketPercent, Wallet } from "lucide-react";
import SettingsSection from "../SettingsSection";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const MotionButton = motion.button;
const MotionDiv = motion.div;

const METHOD_OPTIONS = ["UPI", "CARD", "CASH"];

export default function PaymentsSection() {
  const payments = useSettingsPanelStore((state) => state.draft.payments);
  const expanded = useSettingsPanelStore((state) => state.expanded.refundHistory);
  const setField = useSettingsPanelStore((state) => state.setField);
  const toggleExpanded = useSettingsPanelStore((state) => state.toggleExpanded);
  const { theme } = useSettingsThemeClasses();

  return (
    <SettingsSection
      title="Payments"
      description="Keep your preferred payment stack, invoices, and refunds in one clear billing view."
      icon={Wallet}
      index={4}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`rounded-[1.2rem] border p-4 ${theme.card}`} data-settings-row="">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Default payment</p>
          <p className={`mt-2 text-lg font-semibold ${theme.textPrimary}`}>{payments.defaultPaymentMethod}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {METHOD_OPTIONS.map((method) => {
              const active = payments.defaultPaymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setField("payments", "defaultPaymentMethod", method)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? theme.activeChip : theme.inactiveChip}`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`rounded-[1.2rem] border p-4 ${theme.card}`} data-settings-row="">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Wallet balance</p>
          <p className={`mt-2 text-lg font-semibold ${theme.textPrimary}`}>Rs {payments.walletBalance}</p>
          <p className={`mt-1 text-sm ${theme.textMuted}`}>Auto-applied to small fare corrections and instant refunds.</p>
        </div>
      </div>

      <ToggleSwitch
        id="invoice-delivery"
        checked={payments.invoices}
        onChange={() => setField("payments", "invoices", !payments.invoices)}
        label="Invoices"
        description="Send every completed ride receipt and tax invoice automatically."
      />

      <label className="block" data-settings-row="">
        <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>
          Promo coupon
        </span>
        <div className={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 ${theme.inputGroup}`}>
          <TicketPercent className={`h-4 w-4 ${theme.iconAccent}`} aria-hidden="true" />
          <input
            type="text"
            value={payments.promoCoupon}
            onChange={(event) => setField("payments", "promoCoupon", event.target.value.toUpperCase())}
            placeholder="Apply code"
            className={`w-full bg-transparent text-sm outline-none ${theme.textPrimary} placeholder:text-slate-400`}
          />
        </div>
      </label>

      <div className={`rounded-[1.2rem] border p-4 ${theme.card}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${theme.textPrimary}`}>Refund history</p>
            <p className={`mt-1 text-xs ${theme.textMuted}`}>Latest credits and fare adjustments.</p>
          </div>
          <MotionButton
            type="button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => toggleExpanded("refundHistory")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${theme.subtleButton}`}
          >
            <Receipt className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
            View
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.span>
          </MotionButton>
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <MotionDiv
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {payments.refundHistory.map((refund) => (
                  <div
                    key={refund.id}
                    className={`flex items-center justify-between gap-4 rounded-[1rem] border px-3 py-3 ${theme.badge}`}
                    data-settings-row=""
                  >
                    <div>
                      <p className={`text-sm font-semibold ${theme.textPrimary}`}>{refund.label}</p>
                      <p className={`mt-1 text-xs ${theme.textMuted}`}>{refund.status}</p>
                    </div>
                    <div className={`flex items-center gap-2 text-sm font-semibold ${theme.iconAccent}`}>
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      Rs {refund.amount}
                    </div>
                  </div>
                ))}
              </div>
            </MotionDiv>
          ) : null}
        </AnimatePresence>
      </div>
    </SettingsSection>
  );
}
