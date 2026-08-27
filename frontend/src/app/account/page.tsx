"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, User, Package, MapPin, FileText, Heart, LogOut, Plus, Loader2,
  ArrowRight, Pencil, Check, X, Mail, Phone, Eye, Truck, Settings as SettingsIcon,
  ListChecks, Layers, Wallet, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, cn, orderRef } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { addressApi, orderApi, prescriptionApi, authApi, wishlistApi, mediaUrl, isPdfUrl, ApiError } from "@/lib/api";
import type { Address } from "@/lib/api";
import { productToMedicine } from "@/lib/adapters";
import type { Order, Prescription, ApiProduct, Medicine } from "@/types";

type TabId = "dashboard" | "info" | "orders" | "wishlist" | "addresses" | "prescriptions" | "settings";

const DONE = ["completed", "delivered"];
const DEAD = ["cancelled", "returned", "delivery failed", "refunded"];

function statusTone(status?: string) {
  const s = String(status || "").toLowerCase();
  if (DONE.includes(s)) return "bg-[var(--mint-50)] text-[var(--mint-600)]";
  if (DEAD.includes(s)) return "bg-[#FFEDEA] text-[var(--coral-500)]";
  if (s === "pending") return "bg-[#F3EEFF] text-[#7C5CFC]";
  return "bg-[var(--blue-50)] text-[var(--blue-600)]";
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading, logout, refresh } = useAuth();
  const { toggleWishlist } = useStore();
  const [active, setActive] = useState<TabId>("dashboard");

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState<Address>({
    full_name: "", phone: "", house_no: "", stree_address: "", landmark: "", city: "", state: "", pincode: "", type: "Home",
  });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.push("/login?redirect=/account");
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    Promise.allSettled([
      orderApi.list<Order[]>({ limit: 100 }),
      addressApi.list<Address[]>(),
      prescriptionApi.list<Prescription[]>({ limit: 20 }),
      wishlistApi.list<ApiProduct[]>(),
    ]).then(([o, a, p, w]) => {
      if (o.status === "fulfilled") setOrders(o.value?.data ?? []);
      if (a.status === "fulfilled") setAddresses(a.value ?? []);
      if (p.status === "fulfilled") setPrescriptions(p.value?.data ?? []);
      if (w.status === "fulfilled") setWishlistItems((w.value ?? []).map(productToMedicine));
    }).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const stats = useMemo(() => {
    let pending = 0, completed = 0, spent = 0;
    for (const o of orders) {
      const s = String(o.status || "").toLowerCase();
      if (DONE.includes(s)) { completed += 1; spent += Number(o.amount) || 0; }
      else if (!DEAD.includes(s)) pending += 1;
    }
    return { pending, completed, spent };
  }, [orders]);

  const NAV: { id: TabId | "track" | "logout"; label: string; icon: React.ElementType; count?: number; href?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "info", label: "My Profile", icon: User },
    { id: "orders", label: "My Order List", icon: Package, count: orders.length },
    { id: "wishlist", label: "My Wishlist", icon: Heart, count: wishlistItems.length },
    { id: "addresses", label: "Address List", icon: MapPin, count: addresses.length },
    { id: "prescriptions", label: "Prescriptions", icon: FileText, count: prescriptions.length },
    { id: "track", label: "Track My Order", icon: Truck, href: "/track" },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "logout", label: "Logout", icon: LogOut },
  ];

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId != null) {
        await addressApi.update<Address>(editingId, newAddress);
      } else {
        await addressApi.create<Address>(newAddress);
      }
      const list = await addressApi.list<Address[]>();
      setAddresses(list ?? []);
      resetAddressForm();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
  }

  function resetAddressForm() {
    setShowAddressForm(false);
    setEditingId(null);
    setNewAddress({ full_name: "", phone: "", house_no: "", stree_address: "", landmark: "", city: "", state: "", pincode: "", type: "Home" });
  }

  function handleEditAddress(a: Address) {
    setEditingId(a.ad_id ?? null);
    setNewAddress({
      full_name: a.full_name || "", phone: a.phone || "", house_no: a.house_no || "",
      stree_address: a.stree_address || "", landmark: a.landmark || "", city: a.city || "",
      state: a.state || "", pincode: a.pincode || "", type: a.type || "Home",
    });
    setShowAddressForm(true);
  }

  async function handleRemoveAddress(id: string | number) {
    try {
      await addressApi.remove(id);
      setAddresses((prev) => prev.filter((a) => a.ad_id !== id));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
  }

  // Prescriptions attached to an order can't be deleted — the backend enforces
  // this too (409), we just hide the button for a cleaner UX.
  const usedPrescriptionIds = useMemo(
    () => new Set(orders.map((o) => o.prescription_id).filter(Boolean).map(String)),
    [orders]
  );

  async function handleDeletePrescription(id: string | number) {
    if (!confirm("Delete this prescription? This cannot be undone.")) return;
    try {
      await prescriptionApi.remove(id);
      setPrescriptions((prev) => prev.filter((p) => p.prescription_id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.status === 409 ? "This prescription is used in an order and can't be deleted." : err.message);
        return;
      }
      throw err;
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
    <div className="bg-[#e0e8f5]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr]">
          {/* ------------------------------ SIDEBAR ------------------------------ */}
          <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-6">
            <div className="flex flex-col items-center border-b border-[var(--line)] pb-6">
              <div className="relative">
                <Image
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.customer_name || "User")}`}
                  unoptimized
                  alt="Profile"
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-full border-2 border-[var(--blue-500)] bg-white object-cover"
                />
                <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--blue-500)] text-white">
                  <Camera size={13} />
                </span>
              </div>
              <p className="mt-3 font-display text-lg font-bold text-[var(--ink)]">{user?.customer_name || "Add your name"}</p>
              <p className="text-sm text-[var(--ink-soft)]">{user?.email_id || user?.mobile}</p>
            </div>

            <nav className="mt-5 flex flex-col gap-1">
              {NAV.map((item) => {
                const isActive = active === item.id;
                const inner = (
                  <>
                    <item.icon size={17} className="shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {typeof item.count === "number" && item.count > 0 && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        isActive ? "bg-white/20 text-white" : "bg-[#FFEDEA] text-[var(--coral-500)]"
                      )}>
                        {String(item.count).padStart(2, "0")}
                      </span>
                    )}
                  </>
                );

                if (item.href) {
                  return (
                    <Link key={item.id} href={item.href} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[var(--ink-soft)] hover:bg-black/5">
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => (item.id === "logout" ? logout() : setActive(item.id as TabId))}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-[var(--blue-500)] text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.7)]"
                        : item.id === "logout"
                          ? "text-[var(--coral-500)] hover:bg-[#FFEDEA]"
                          : "text-[var(--ink-soft)] hover:bg-black/5"
                    )}
                  >
                    {inner}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ------------------------------ CONTENT ------------------------------ */}
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center rounded-2xl border border-[var(--line)] bg-white py-24 text-[var(--ink-soft)]">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <>
                {/* ---------------- DASHBOARD ---------------- */}
                {active === "dashboard" && (
                  <>
                    <Card>
                      <SectionTitle>Summary</SectionTitle>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <StatCard label="Pending Orders" value={String(stats.pending)} icon={ListChecks} bg="bg-[#F5F1FF]" fg="text-[#7C5CFC]" chip="bg-[#7C5CFC]" />
                        <StatCard label="Completed Orders" value={String(stats.completed)} icon={Layers} bg="bg-[var(--mint-50)]" fg="text-[var(--mint-600)]" chip="bg-[var(--mint-600)]" />
                        <StatCard label="Total Spent" value={formatINR(stats.spent)} icon={Wallet} bg="bg-[#FFF1EE]" fg="text-[var(--coral-500)]" chip="bg-[var(--coral-500)]" />
                      </div>
                    </Card>

                    <Card>
                      <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
                        <p className="font-display text-lg font-bold text-[var(--ink)]">Recent Orders</p>
                        <button
                          onClick={() => setActive("orders")}
                          className="rounded-lg bg-[var(--blue-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)]"
                        >
                          View All Orders
                        </button>
                      </div>

                      {orders.length === 0 ? (
                        <EmptyState text="No orders yet." cta={{ href: "/shop", label: "Start Shopping" }} />
                      ) : (
                        <OrdersTable orders={orders.slice(0, 5)} />
                      )}
                    </Card>
                  </>
                )}

                {/* ---------------- PROFILE ---------------- */}
                {active === "info" && (
                  <Card>
                    <PersonalInfoTab user={user} refresh={refresh} />
                  </Card>
                )}

                {/* ---------------- ORDERS ---------------- */}
                {active === "orders" && (
                  <Card>
                    <SectionTitle>My Order List</SectionTitle>
                    {orders.length === 0 ? (
                      <EmptyState text="No orders yet." cta={{ href: "/shop", label: "Start Shopping" }} />
                    ) : (
                      <OrdersTable orders={orders} />
                    )}
                  </Card>
                )}

                {/* ---------------- WISHLIST ---------------- */}
                {active === "wishlist" && (
                  <Card>
                    <SectionTitle>My Wishlist ({wishlistItems.length})</SectionTitle>
                    {wishlistItems.length === 0 ? (
                      <EmptyState text="No items saved yet." cta={{ href: "/shop", label: "Browse Medicines" }} />
                    ) : (
                      <div className="space-y-3">
                        {wishlistItems.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                            <Image src={m.image} alt={m.name} width={48} height={48} className="rounded-lg object-cover" />
                            <Link href={`/medicines/${m.slug}`} className="flex-1 text-sm font-medium text-[var(--ink)] hover:underline">{m.name}</Link>
                            <p className="font-mono-nums text-sm font-semibold">{formatINR(m.price)}</p>
                            <button onClick={() => handleRemoveWishlist(m.id)} className="text-xs font-medium text-[var(--coral-500)]">Remove</button>
                          </div>
                        ))}
                        <Link href="/wishlist" className="inline-flex items-center gap-1 pt-2 text-sm font-semibold text-[var(--blue-600)]">
                          View full wishlist <ArrowRight size={14} />
                        </Link>
                      </div>
                    )}
                  </Card>
                )}

                {/* ---------------- ADDRESSES ---------------- */}
                {active === "addresses" && (
                  <Card>
                    <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
                      <p className="font-display text-lg font-bold text-[var(--ink)]">Address List</p>
                      <button onClick={() => { if (showAddressForm) { resetAddressForm(); } else { setEditingId(null); setShowAddressForm(true); } }} className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)]">
                        <Plus size={15} /> Add New
                      </button>
                    </div>
                    {showAddressForm && (
                      <form onSubmit={handleAddAddress} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-2">
                        <p className="font-display text-sm font-bold text-[var(--ink)] sm:col-span-2">{editingId != null ? "Edit Address" : "Add New Address"}</p>
                        <Input required placeholder="Full name" value={newAddress.full_name} onChange={(v) => setNewAddress({ ...newAddress, full_name: v })} />
                        <Input required placeholder="Mobile number" value={newAddress.phone} onChange={(v) => setNewAddress({ ...newAddress, phone: v })} />
                        <Input placeholder="House / Flat no." value={newAddress.house_no || ""} onChange={(v) => setNewAddress({ ...newAddress, house_no: v })} />
                        <Input required placeholder="Street address" value={newAddress.stree_address} onChange={(v) => setNewAddress({ ...newAddress, stree_address: v })} />
                        <div className="sm:col-span-2">
                          <Input placeholder="Landmark (optional)" value={newAddress.landmark || ""} onChange={(v) => setNewAddress({ ...newAddress, landmark: v })} />
                        </div>
                        <Input required placeholder="City" value={newAddress.city} onChange={(v) => setNewAddress({ ...newAddress, city: v })} />
                        <Input required placeholder="State" value={newAddress.state} onChange={(v) => setNewAddress({ ...newAddress, state: v })} />
                        <Input required placeholder="Pincode" value={newAddress.pincode} onChange={(v) => setNewAddress({ ...newAddress, pincode: v })} />
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <button type="submit" className="rounded-full bg-[var(--blue-500)] px-5 py-2.5 text-sm font-semibold text-white sm:w-fit">{editingId != null ? "Update Address" : "Save Address"}</button>
                          <button type="button" onClick={resetAddressForm} className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-soft)] sm:w-fit">Cancel</button>
                        </div>
                      </form>
                    )}
                    {addresses.length === 0 ? (
                      <EmptyState text="No saved addresses." />
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {addresses.map((a) => (
                          <div key={a.ad_id} className="rounded-xl border border-[var(--line)] p-4">
                            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                              {a.full_name}
                              {a.is_default ? <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--blue-600)]">Default</span> : null}
                            </p>
                            <p className="mb-1 text-sm text-[var(--ink-soft)]">
                              {[a.house_no, a.stree_address, a.landmark].filter(Boolean).join(", ")}, {a.city}, {a.state} - {a.pincode}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-[var(--ink-soft)]">{a.phone}</p>
                              <div className="flex items-center gap-3">
                                <button onClick={() => handleEditAddress(a)} className="text-xs font-medium text-[var(--blue-600)]">Edit</button>
                                <button onClick={() => a.ad_id && handleRemoveAddress(a.ad_id)} className="text-xs font-medium text-[var(--coral-500)]">Remove</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {/* ---------------- PRESCRIPTIONS ---------------- */}
                {active === "prescriptions" && (
                  <Card>
                    <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
                      <p className="font-display text-lg font-bold text-[var(--ink)]">Prescriptions</p>
                      <Link href="/prescription-upload" className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)]">
                        <Plus size={15} /> Upload New
                      </Link>
                    </div>
                    {prescriptions.length === 0 ? (
                      <EmptyState text="No prescriptions uploaded yet." />
                    ) : (
                      <div className="space-y-3">
                        {prescriptions.map((p) => (
                          <div key={p.prescription_id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-4">
                            {p.images?.[0] && !isPdfUrl(p.images[0]) ? (
                              <Image src={mediaUrl(p.images[0])} alt="prescription" width={40} height={40} className="rounded-lg object-cover" />
                            ) : (
                              <FileText size={18} className="text-[var(--blue-500)]" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[var(--ink)]">{p.reference_code || `Prescription #${p.prescription_id}`}</p>
                              <p className="text-xs text-[var(--ink-soft)]">{p.doctor_name || "—"}</p>
                            </div>
                            <a href={mediaUrl(p.images[0])} target="_blank" rel="noopener noreferrer" className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize")}>View</a>
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", statusTone(p.status))}>{p.status}</span>
                            {p.prescription_id != null && !usedPrescriptionIds.has(String(p.prescription_id)) && (
                              <button onClick={() => handleDeletePrescription(p.prescription_id!)} className="text-xs font-medium text-[var(--coral-500)]">Delete</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {/* ---------------- SETTINGS ---------------- */}
                {active === "settings" && (
                  <Card>
                    <SectionTitle>Settings</SectionTitle>
                    <div className="space-y-3">
                      <SettingRow title="Personal Information" desc="Update your name and email address" onClick={() => setActive("info")} />
                      <SettingRow title="Delivery Addresses" desc="Manage your saved addresses" onClick={() => setActive("addresses")} />
                      <SettingRow title="Track an Order" desc="Check the live status of your shipment" href="/track" />
                      <SettingRow title="Need Help?" desc="Reach our support team" href="/contact" />
                      <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3.5 text-sm font-semibold text-[var(--coral-500)]">
                        <LogOut size={15} /> Logout from this device
                      </button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ SMALL BUILDING BLOCKS ============================ */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 border-b border-[var(--line)] pb-4 font-display text-lg font-bold text-[var(--ink)]">{children}</p>;
}

function StatCard({ label, value, icon: Icon, bg, fg, chip }: {
  label: string; value: string; icon: React.ElementType; bg: string; fg: string; chip: string;
}) {
  return (
    <div className={cn("flex items-center justify-between rounded-xl p-5", bg)}>
      <div>
        <p className={cn("font-display text-2xl font-bold", fg)}>{value}</p>
        <p className={cn("mt-1 text-sm font-medium", fg)}>{label}</p>
      </div>
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-full text-white", chip)}>
        <Icon size={20} />
      </span>
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            <th className="px-3 pb-3">#Order No</th>
            <th className="px-3 pb-3">Purchased Date</th>
            <th className="px-3 pb-3">Total</th>
            <th className="px-3 pb-3">Status</th>
            <th className="px-3 pb-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={o.order_id} className={cn("text-sm", i % 2 === 0 && "bg-[#F8FAFD]")}>
              <td className="rounded-l-lg px-3 py-3.5">
                <Link href={`/account/orders/${o.order_id}`} className="font-semibold text-[var(--blue-600)] hover:underline">
                  {orderRef(o)}
                </Link>
              </td>
              <td className="px-3 py-3.5 text-[var(--ink-soft)]">
                {new Date(o.order_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </td>
              <td className="px-3 py-3.5 font-mono-nums font-semibold text-[var(--ink)]">{formatINR(o.amount)}</td>
              <td className="px-3 py-3.5">
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", statusTone(o.status))}>{o.status}</span>
              </td>
              <td className="rounded-r-lg px-3 py-3.5 text-right">
                <Link
                  href={`/account/orders/${o.order_id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-600)]"
                >
                  <Eye size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] py-14 text-center">
      <p className="text-sm text-[var(--ink-soft)]">{text}</p>
      {cta && (
        <Link href={cta.href} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--blue-500)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)]">
          {cta.label} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function Input({ value, onChange, placeholder, required }: {
  value: string; onChange: (v: string) => void; placeholder: string; required?: boolean;
}) {
  return (
    <input
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-[var(--line)] px-4 text-sm outline-none focus:border-[var(--blue-500)]"
    />
  );
}

function SettingRow({ title, desc, onClick, href }: { title: string; desc: string; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <div className="text-left">
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="text-xs text-[var(--ink-soft)]">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-[var(--ink-soft)]" />
    </>
  );
  const cls = "flex w-full items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3.5 hover:border-[var(--blue-500)]";
  return href ? <Link href={href} className={cls}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>;
}

/* ================================ PROFILE TAB ================================ */

function PersonalInfoTab({ user, refresh }: { user: import("@/types").Customer | null; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.customer_name || "");
  const [email, setEmail] = useState(user?.email_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setName(user?.customer_name || "");
    setEmail(user?.email_id || "");
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await authApi.updateProfile({ customer_name: name.trim(), email_id: email.trim() });
      await refresh();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
        <p className="font-display text-lg font-bold text-[var(--ink)]">My Profile</p>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)] hover:underline">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--mint-50)] bg-[var(--mint-50)]/50 px-4 py-2.5 text-sm text-[var(--mint-600)]">
          <Check size={15} /> Profile updated
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-2.5 text-sm text-[var(--coral-500)]">{error}</div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">Full Name</span>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3.5 focus-within:border-[var(--blue-500)]">
              <User size={14} className="shrink-0 text-[var(--ink-soft)]" />
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-transparent text-sm outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">Email</span>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3.5 focus-within:border-[var(--blue-500)]">
              <Mail size={14} className="shrink-0 text-[var(--ink-soft)]" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent text-sm outline-none" />
            </div>
          </label>

          <div className="sm:col-span-2">
            <ReadField label="Phone" value={user?.mobile || "—"} icon={<Phone size={13} />} note="Mobile number can't be changed here" />
          </div>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="md" disabled={saving} icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-5 text-sm font-medium text-[var(--ink-soft)] hover:bg-black/5">
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadField label="Full Name" value={user?.customer_name || "—"} icon={<User size={13} />} />
          <ReadField label="Email" value={user?.email_id || "—"} icon={<Mail size={13} />} />
          <ReadField label="Phone" value={user?.mobile || "—"} icon={<Phone size={13} />} />
        </div>
      )}
    </div>
  );
}

function ReadField({ label, value, icon, note }: { label: string; value: string; icon?: React.ReactNode; note?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-black/[0.02] px-4 py-2.5 text-sm text-[var(--ink)]">
        {icon}
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] text-[var(--ink-soft)]">{note}</p>}
    </div>
  );
}
