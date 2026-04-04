import { memo, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

function highlightRow(selector) {
  if (!selector) {
    return;
  }

  gsap.fromTo(
    selector,
    { backgroundColor: "rgba(34, 211, 238, 0.16)" },
    {
      backgroundColor: "rgba(34, 211, 238, 0)",
      duration: 1.1,
      ease: "power2.out",
      overwrite: "auto",
    }
  );
}

function VirtualizedDataTable({
  columns,
  rows,
  isDark = true,
  loading = false,
  emptyLabel = "No data",
  rowActions,
  rowKey = "id",
  maxHeight = 520,
  rowHeight = 78,
  highlightedRows = {},
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const bodyRef = useRef(null);
  const templateColumns = useMemo(
    () =>
      columns
        .map((column) => column.width || "minmax(140px,1fr)")
        .concat(rowActions ? ["max-content"] : [])
        .join(" "),
    [columns, rowActions]
  );
  const totalRows = rows.length;
  const visibleCount = Math.max(Math.ceil(maxHeight / rowHeight) + 4, 8);
  const startIndex = Math.max(Math.floor(scrollTop / rowHeight) - 2, 0);
  const endIndex = Math.min(startIndex + visibleCount, totalRows);
  const visibleRows = totalRows > 18 ? rows.slice(startIndex, endIndex) : rows;
  const offsetTop = totalRows > 18 ? startIndex * rowHeight : 0;
  const totalHeight = totalRows > 18 ? totalRows * rowHeight : "auto";

  useEffect(() => {
    Object.entries(highlightedRows || {}).forEach(([id, enabled]) => {
      if (!enabled || !bodyRef.current) {
        return;
      }
      const selector = bodyRef.current.querySelector(`[data-rowid="${id}"]`);
      highlightRow(selector);
    });
  }, [highlightedRows, visibleRows]);

  return (
    <div className={`overflow-hidden rounded-[1.2rem] border ${isDark ? "border-[rgba(41,56,83,0.82)]" : "border-slate-200"}`}>
      <div
        className={`grid gap-0 text-left text-sm font-medium ${
          isDark ? "bg-[#0d182b]/86 text-slate-400" : "bg-slate-50 text-slate-500"
        }`}
        style={{ gridTemplateColumns: templateColumns }}
      >
        {columns.map((column) => (
          <div key={column.key} className="px-4 py-3">
            {column.label}
          </div>
        ))}
        {rowActions ? <div className="px-4 py-3">Actions</div> : null}
      </div>

      {loading ? (
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`loading-${index}`} className={`loading-shimmer h-12 rounded-xl ${isDark ? "bg-[#0d182b]" : "bg-slate-100"}`} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">{emptyLabel}</div>
      ) : (
        <div
          ref={bodyRef}
          className="overflow-y-auto"
          style={{ maxHeight }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetTop}px)` }}>
              {visibleRows.map((row) => {
                const key = row[rowKey] ?? row.id ?? row.key;
                return (
                  <div
                    key={key}
                    data-rowid={key}
                    className={`grid border-b text-sm transition ${isDark ? "border-[rgba(41,56,83,0.82)] text-slate-200 hover:bg-[#101b2f]/80" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    style={{ gridTemplateColumns: templateColumns, minHeight: rowHeight }}
                  >
                    {columns.map((column) => (
                      <div key={column.key} className="flex items-center px-4 py-3">
                        {column.render ? column.render(row) : row[column.key]}
                      </div>
                    ))}
                    {rowActions ? (
                      <div className="flex items-center px-4 py-3">
                        <div className="flex flex-wrap gap-2">{rowActions(row)}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(VirtualizedDataTable);
