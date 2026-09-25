import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = 14,
  className,
  hideCount = false,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
  hideCount?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={size}
            className={
              i < Math.round(value)
                ? "fill-[var(--amber-500)] text-[var(--amber-500)]"
                : "fill-transparent text-[var(--line)]"
            }
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-[var(--ink)]">{value.toFixed(1)}</span>
      {!hideCount && count !== undefined && (
        <span className="text-xs text-[var(--ink-soft)]">({count})</span>
      )}
    </div>
  );
}
