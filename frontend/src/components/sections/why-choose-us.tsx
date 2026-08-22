import { Truck, RefreshCw, Wallet, Headphones } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const points = [
  { icon: Truck, title: "Free Delivery", desc: "Orders Over 1500" },
  { icon: RefreshCw, title: "Get Refund", desc: "Hassle-free return policy" },
  { icon: Wallet, title: "Safe Payment", desc: "100% Secure Payment" },
  { icon: Headphones, title: "24/7 Support", desc: "Feel Free To Call Us" },
];

export function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal className="rounded-lg bg-ink px-8 py-8">
        <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {points.map((p, i) => (
            <div
              key={p.title}
              className={`flex items-center gap-4 py-4 sm:py-0 ${
                i !== 0 ? "sm:pl-6 lg:border-l lg:border-white/10" : ""
              }`}
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center bg-blue-500 text-white"
                style={{ borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%" }}
              >
                <p.icon size={22} />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-white">{p.title}</p>
                <p className="text-xs text-white/60">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}