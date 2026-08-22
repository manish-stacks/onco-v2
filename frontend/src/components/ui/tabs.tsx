"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  active: controlledActive,
  onChange,
}: {
  tabs: { label: string; content: ReactNode }[];
  /** If provided it becomes controlled — for jump links such as "Be the first to review" */
  active?: number;
  onChange?: (i: number) => void;
}) {
  const [internalActive, setInternalActive] = useState(0);
  const active = controlledActive ?? internalActive;
  const setActive = onChange ?? setInternalActive;

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto rounded-full bg-black/[0.04] p-1">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === i
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">{tabs[active].content}</div>
    </div>
  );
}