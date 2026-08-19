"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Interactive 1-5 star picker — Rating component sirf display ke liye hai, ye input ke liye */
export function StarRatingInput({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${star} star`}
          >
            <Star
              size={size}
              className={cn(
                star <= shown ? "fill-[var(--amber-500)] text-[var(--amber-500)]" : "fill-transparent text-[var(--line)]"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}