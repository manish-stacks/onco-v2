"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export function Reveal({
  children,
  className,
  y = 28,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay,
          ease: "power3.out",
          scrollTrigger: undefined,
        }
      );
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay, ease: "power3.out" });
              observer.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      gsap.set(el, { opacity: 0, y });
      observer.observe(el);
      return () => observer.disconnect();
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
