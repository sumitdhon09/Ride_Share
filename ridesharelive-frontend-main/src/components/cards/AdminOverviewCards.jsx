import { memo } from "react";
import OverviewStatCard from "../OverviewStatCard";

function AdminOverviewCards({ cards, isDark = true, compact = false }) {
  return (
    <div
      className={
        compact
          ? "flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 md:grid md:max-w-none md:snap-none md:grid-cols-4 md:overflow-visible md:pb-0 xl:grid-cols-8 xl:gap-2.5 [&::-webkit-scrollbar]:hidden"
          : "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-4 md:grid md:max-w-none md:snap-none md:grid-cols-4 md:overflow-visible md:pb-0 xl:grid-cols-8 xl:gap-3 [&::-webkit-scrollbar]:hidden"
      }
    >
      {cards.map((card, index) => (
        <div key={card.label} className="min-w-[min(17.5rem,82vw)] shrink-0 snap-center sm:min-w-[min(16rem,78vw)] md:min-w-0 md:shrink">
          <OverviewStatCard {...card} delay={index * 0.028} isDark={isDark} compact={compact} />
        </div>
      ))}
    </div>
  );
}

export default memo(AdminOverviewCards);
