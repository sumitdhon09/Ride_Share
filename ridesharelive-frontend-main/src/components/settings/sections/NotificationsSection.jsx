import { BellRing } from "lucide-react";
import SettingsSection from "../SettingsSection";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";

const NOTIFICATION_ROWS = [
  { key: "rideUpdates", label: "Ride updates", description: "Pickup, start, and completion state changes." },
  { key: "driverArrived", label: "Driver arrived", description: "Fast arrival prompts with location pings." },
  { key: "paymentAlerts", label: "Payment alerts", description: "Fare captures, wallet usage, and settlement events." },
  { key: "fareDrop", label: "Fare drop", description: "Watchlist alerts when your saved route gets cheaper." },
  { key: "promoOffers", label: "Promo offers", description: "Seasonal offers, wallet credits, and coupons." },
  { key: "emailSummaries", label: "Email summaries", description: "Weekly trip summary and invoice digest." },
];

export default function NotificationsSection() {
  const notifications = useSettingsPanelStore((state) => state.draft.notifications);
  const toggleField = useSettingsPanelStore((state) => state.toggleField);

  return (
    <SettingsSection
      title="Notifications"
      description="Fine tune what reaches your phone, inbox, and ride status feed."
      icon={BellRing}
      index={2}
    >
      {NOTIFICATION_ROWS.map((item) => (
        <ToggleSwitch
          key={item.key}
          id={item.key}
          checked={notifications[item.key]}
          onChange={() => toggleField("notifications", item.key)}
          label={item.label}
          description={item.description}
        />
      ))}
    </SettingsSection>
  );
}
