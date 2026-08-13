import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "blue" | "mint" | "coral" | "amber" | "ink";

const tones: Record<Tone, string> = {
  blue: "bg-[var(--blue-50)] text-[var(--blue-700)]",
  mint: "bg-[var(--mint-50)] text-[var(--mint-600)]",
  coral: "bg-[#FFEDEA] text-[var(--coral-500)]",
  amber: "bg-[#FFF4DE] text-[#B4790C]",
  ink: "bg-[var(--ink)] text-white",
};

export function Badge({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
