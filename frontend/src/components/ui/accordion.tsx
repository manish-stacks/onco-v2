"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AccordionItem = {
  question: string;
  answer: string;
};

interface AccordionProps {
  items: AccordionItem[];
  columns?: 1 | 2;
}

export function Accordion({
  items,
  columns = 1,
}: AccordionProps) {
  if (columns === 1) {
    return <SingleColumn items={items} />;
  }

  const leftItems = items.filter((_, index) => index % 2 === 0);
  const rightItems = items.filter((_, index) => index % 2 !== 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <AccordionColumn items={leftItems} />
      <AccordionColumn items={rightItems} />
    </div>
  );
}

function AccordionColumn({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      {items.map((item, index) => {
        const isOpen = open === index;

        return (
          <div
            key={index}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-300"
          >
            <button
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between px-6 py-2 text-left"
            >
              <h3 className="pr-4 text-lg font-semibold text-slate-900">
                {item.question}
              </h3>

              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300",
                  isOpen && "rotate-180 text-sky-600"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: "easeInOut",
                  }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-200 px-6 py-5">
                    <p className="leading-7 text-slate-600">
                      {item.answer}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function SingleColumn({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      {items.map((item, index) => {
        const isOpen = open === index;

        return (
          <div
            key={index}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between px-6 py-5 text-left"
            >
              <h3 className="pr-4 text-lg font-semibold text-slate-900">
                {item.question}
              </h3>

              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-slate-500 transition-transform duration-300",
                  isOpen && "rotate-180 text-sky-600"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: "easeInOut",
                  }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-200 px-6 py-5">
                    <p className="leading-7 text-slate-600">
                      {item.answer}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}