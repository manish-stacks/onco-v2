"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Package, MapPin, FileText, Heart, LogOut, Plus, Loader2, ArrowRight } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { addressApi, orderApi, prescriptionApi, mediaUrl, ApiError } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import { wishlistApi } from "@/lib/api";
import type { Address, Order, Prescription, ApiProduct, Medicine } from "@/types";

const TABS = [
  { id: "info", label: "Personal Info", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "prescriptions", label: "Prescriptions", icon: FileText },
  { id: "wishlist", label: "Wishlist", icon: Heart },
];

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading, logout } = useAuth();
  const { toggleWishlist } = useStore();
  const [active, setActive] = useState("info");

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState<Address>({ name: "", mobile: "", address_line: "", city: "", state: "", pincode: "" });
  const [showAddressForm, setShowAddressForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.push("/login?redirect=/account");
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.allSettled([
      orderApi.list<Order[]>({ limit: 10 }),
      addressApi.list<Address[]>(),
      prescriptionApi.list<Prescription[]>({ limit: 10 }),
      wishlistApi.list<ApiProduct[]>(),
    ]).then(([o, a, p, w]) => {
      if (o.status === "fulfilled") setOrders(o.value?.data ?? []);
      if (a.status === "fulfilled") setAddresses(a.value ?? []);
      if (p.status === "fulfilled") setPrescriptions(p.value?.data ?? []);
      if (w.status === "fulfilled") setWishlistItems((w.value ?? []).map(productToMedicine));
    }).finally(() => setLoading(false));
  }, [isLoggedIn]);

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await addressApi.create<Address>(newAddress);
      if (created) setAddresses((prev) => [...prev, created]);
      setShowAddressForm(false);
      setNewAddress({ name: "", mobile: "", address_line: "", city: "", state: "", pincode: "" });
    } catch {
      /* surfaced via toast elsewhere if needed */
    }
  }

  async function handleRemoveAddress(id: string | number) {
    try {
      await addressApi.remove(id);
      setAddresses((prev) => prev.filter((a) => a.address_id !== id));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
  }

  async function handleRemoveWishlist(id: string) {
    await toggleWishlist(id);
    setWishlistItems((prev) => prev.filter((m) => m.id !== id));
  }

  if (authLoading || !isLoggedIn) {
    return <div className="flex min-h-[50vh] items-center justify-center text-[var(--ink-soft)]"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-[var(--ink)]">My Account</h1>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--coral-500)]">
          <LogOut size={15} /> Logout
        </button>
      </div>
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
          {loading ? (
            <div className="flex justify-center py-16 text-[var(--ink-soft)]"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {active === "info" && (
                <div>
                  <p className="mb-6 font-semibold text-[var(--ink)]">Personal Information</p>
                  <div className="mb-6 flex items-center gap-4">
                    <Image src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.customer_name || "User")}`} unoptimized alt="Profile" width={64} height={64} className="rounded-full" />
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{user?.customer_name || "—"}</p>
                      <p className="text-sm text-[var(--ink-soft)]">{user?.mobile}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ReadField label="Full Name" value={user?.customer_name as string || "—"} />
                    <ReadField label="Email" value={user?.email as string || "—"} />
                    <ReadField label="Phone" value={user?.mobile as string || "—"} />
                  </div>
                </div>
              )}

              {active === "orders" && (
                <div>
                  <p className="mb-6 font-semibold text-[var(--ink)]">My Orders</p>
                  {orders.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">No orders yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((o) => (
                        <Link
                          key={o.order_id}
                          href={`/account/orders/${o.order_id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4 hover:border-[var(--blue-500)]"
                        >
                          <div>
                            <p className="font-semibold text-[var(--ink)]">{o.invoice_number || `#${o.order_id}`}</p>
                            <p className="text-xs text-[var(--ink-soft)]">{new Date(o.order_date).toLocaleDateString()}</p>
                          </div>
                          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", o.status?.toLowerCase() === "delivered" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : o.status?.toLowerCase() === "cancelled" ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-600)]")}>
                            {o.status}
                          </span>
                          <p className="font-mono-nums font-semibold text-[var(--ink)]">{formatINR(o.amount)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {active === "addresses" && (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <p className="font-semibold text-[var(--ink)]">Saved Addresses</p>
                    <button onClick={() => setShowAddressForm((s) => !s)} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)]">
                      <Plus size={15} /> Add New
                    </button>
                  </div>
                  {showAddressForm && (
                    <form onSubmit={handleAddAddress} className="mb-6 grid grid-cols-1 gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4 sm:grid-cols-2">
                      <input required placeholder="Full name" value={newAddress.name} onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                      <input required placeholder="Mobile number" value={newAddress.mobile} onChange={(e) => setNewAddress({ ...newAddress, mobile: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                      <input required placeholder="Address" value={newAddress.address_line} onChange={(e) => setNewAddress({ ...newAddress, address_line: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none sm:col-span-2" />
                      <input required placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                      <input required placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                      <input required placeholder="Pincode" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                      <button type="submit" className="rounded-full bg-[var(--blue-500)] px-5 py-2.5 text-sm font-semibold text-white sm:col-span-2 sm:w-fit">Save Address</button>
                    </form>
                  )}
                  {addresses.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">No saved addresses.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {addresses.map((a) => (
                        <div key={a.address_id} className="rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                          <p className="mb-1 text-sm font-semibold text-[var(--ink)]">{a.name}</p>
                          <p className="mb-1 text-sm text-[var(--ink-soft)]">{a.address_line}, {a.city}, {a.state} - {a.pincode}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[var(--ink-soft)]">{a.mobile}</p>
                            <button onClick={() => a.address_id && handleRemoveAddress(a.address_id)} className="text-xs font-medium text-[var(--coral-500)]">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {active === "prescriptions" && (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <p className="font-semibold text-[var(--ink)]">Saved Prescriptions</p>
                    <Link href="/prescription-upload" className="flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)]">
                      <Plus size={15} /> Upload New
                    </Link>
                  </div>
                  {prescriptions.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">No prescriptions uploaded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map((p) => (
                        <div key={p.prescription_id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] p-4">
                          {p.images?.[0] ? (
                            <Image src={mediaUrl(p.images[0])} alt="prescription" width={40} height={40} className="rounded-[var(--radius-sm)] object-cover" />
                          ) : (
                            <FileText size={18} className="text-[var(--blue-500)]" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--ink)]">{p.reference_code || `Prescription #${p.prescription_id}`}</p>
                            <p className="text-xs text-[var(--ink-soft)]">{p.doctor_name || "—"}</p>
                          </div>
                          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", p.status === "approved" ? "bg-[var(--mint-50)] text-[var(--mint-600)]" : p.status === "rejected" ? "bg-[#FFEDEA] text-[var(--coral-500)]" : "bg-[var(--blue-50)] text-[var(--blue-600)]")}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
                          <Image src={m.image} alt={m.name} width={48} height={48} className="rounded-[var(--radius-sm)] object-cover" />
                          <Link href={`/medicines/${m.slug}`} className="flex-1 text-sm font-medium text-[var(--ink)] hover:underline">{m.name}</Link>
                          <p className="font-mono-nums text-sm font-semibold">{formatINR(m.price)}</p>
                          <button onClick={() => handleRemoveWishlist(m.id)} className="text-xs font-medium text-[var(--coral-500)]">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link href="/wishlist" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue-600)]">
                    View full wishlist <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </>
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
