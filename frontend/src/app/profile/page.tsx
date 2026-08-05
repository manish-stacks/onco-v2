"use client";

import Image from "next/image";
import { useState } from "react";
import { User, Package, MapPin, FileText, Heart, Bell, Settings } from "lucide-react";
import { medicines } from "@/lib/data";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";

const MOCK_ORDERS = [
  { id: "MC482913", date: "28 Jul 2026", status: "Delivered", total: 842, items: 3 },
  { id: "MC471820", date: "12 Jul 2026", status: "Delivered", total: 1250, items: 5 },
  { id: "MC459122", date: "02 Jul 2026", status: "Cancelled", total: 340, items: 2 },
];

const MOCK_ADDRESSES = [
  { label: "Home", line: "42 Green Park Extension, New Delhi - 110016", phone: "+91 98xxxxxx21" },
  { label: "Work", line: "Cyber Hub, DLF Phase 2, Gurugram - 122002", phone: "+91 98xxxxxx21" },
];

const TABS = [
  { id: "info", label: "Personal Info", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "prescriptions", label: "Prescriptions", icon: FileText },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function ProfilePage() {
  const [active, setActive] = useState("info");
  const { wishlist } = useStore();
  const wishlistItems = medicines.filter((m) => wishlist.includes(m.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">My Account</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-[var(--radius-sm)] px-4 py-3 text-sm font-medium",
                active === t.id ? "bg-[var(--blue-50)] text-[var(--blue-600)]" : "text-[var(--ink-soft)] hover:bg-black/5"
              )}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </aside>

        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 sm:p-8">
          {active === "info" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Personal Information</p>
              <div className="mb-6 flex items-center gap-4">
                <Image src="https://picsum.photos/seed/profile-user/120/120" alt="Profile" width={64} height={64} className="rounded-full" />
                <div>
                  <p className="font-semibold text-[var(--ink)]">Aditi Sharma</p>
                  <p className="text-sm text-[var(--ink-soft)]">Member since Jan 2025</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ReadField label="Full Name" value="Aditi Sharma" />
                <ReadField label="Email" value="aditi.sharma@example.com" />
                <ReadField label="Phone" value="+91 98xxxxxx21" />
                <ReadField label="Date of Birth" value="14 March 1994" />
              </div>
            </div>
          )}

          {active === "orders" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">My Orders</p>
              <div className="space-y-3">
                {MOCK_ORDERS.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                    <div>
                      <p className="font-semibold text-[var(--ink)]">#{o.id}</p>
                      <p className="text-xs text-[var(--ink-soft)]">{o.date} · {o.items} items</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        o.status === "Delivered" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : "bg-[#FFEDEA] text-[var(--coral-500)]"
                      )}
                    >
                      {o.status}
                    </span>
                    <p className="font-mono-nums font-semibold text-[var(--ink)]">{formatINR(o.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "addresses" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Saved Addresses</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {MOCK_ADDRESSES.map((a) => (
                  <div key={a.label} className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                    <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{a.label}</p>
                    <p className="mb-1 text-sm text-[var(--ink-soft)]">{a.line}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{a.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "prescriptions" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Saved Prescriptions</p>
              <div className="space-y-3">
                {["Dr. Anjali Rao — 12 Jun 2026", "Dr. Suresh Menon — 03 May 2026"].map((p) => (
                  <div key={p} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                    <FileText size={18} className="text-[var(--blue-500)]" />
                    <p className="text-sm text-[var(--ink)]">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "wishlist" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Wishlist ({wishlistItems.length})</p>
              {wishlistItems.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">No items saved yet.</p>
              ) : (
                <div className="space-y-3">
                  {wishlistItems.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                      <Image src={m.image} alt={m.name} width={48} height={48} className="rounded-[var(--radius-sm)]" />
                      <p className="text-sm font-medium text-[var(--ink)]">{m.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {active === "notifications" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Notifications</p>
              <div className="space-y-3">
                {[
                  ["Email me about order updates", true],
                  ["SMS delivery alerts", true],
                  ["Refill reminders", false],
                  ["Promotional offers", false],
                ].map(([label, checked]) => (
                  <label key={label as string} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--line)] p-4 text-sm">
                    {label as string}
                    <input type="checkbox" defaultChecked={checked as boolean} className="h-4 w-4 accent-[var(--blue-500)]" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {active === "settings" && (
            <div>
              <p className="mb-6 font-semibold text-[var(--ink)]">Settings</p>
              <div className="space-y-3 text-sm">
                <button className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-4 text-left hover:border-[var(--blue-500)]">Change Password</button>
                <button className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] p-4 text-left hover:border-[var(--blue-500)]">Manage Linked Devices</button>
                <button className="w-full rounded-[var(--radius-sm)] border border-[#FCC7BE] p-4 text-left text-[var(--coral-500)]">Delete Account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="rounded-[var(--radius-sm)] border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink)]">{value}</p>
    </div>
  );
}
