"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { FaArrowUpFromBracket } from "react-icons/fa6";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--blue-500)] text-white shadow-lg transition-colors hover:bg-[var(--blue-600)]"
    >
      <FaArrowUpFromBracket size={18} />
    </button>
  );
}
