"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";

export function ToastHost() {
  const { toast } = useStore();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="glass flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[var(--ink)] shadow-xl"
          >
            <CheckCircle2 size={16} className="text-[var(--mint-500)]" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
