"use client";

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Truck,
  CreditCard,
  Wallet,
  Landmark,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  FileWarning,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  User,
  ClipboardList,
  Bookmark,
  ShoppingBag,
  ShieldCheck,
  BadgeCheck,
  Headphones,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { orderApi, addressApi, ApiError, type RazorpayOrderInfo } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/load-razorpay";
import { readStoredCoupon, clearStoredCoupon, type StoredCoupon } from "@/lib/coupon-storage";

const STEPS = ["Address", "Delivery", "Payment", "Review"];
const STEP_ICONS = [MapPin, Truck, CreditCard, FileText];
const STEP_CTA_LABEL = ["Proceed to Delivery", "Proceed to Payment", "Proceed to Review"];
const SLOTS = ["Today, 6 PM – 9 PM", "Tomorrow, 9 AM – 12 PM", "Tomorrow, 2 PM – 5 PM"];
const ADDRESS_PREVIEW_COUNT = 4;

// UI label -> backend payment_mode ('cod' | 'online')
const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, mode: "online" as const },
  { id: "upi", label: "UPI", icon: Wallet, mode: "online" as const },
  { id: "cod", label: "Cash on Delivery", icon: Landmark, mode: "cod" as const },
];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

// ---------------------------------------------------------------------------
// Address types — matches the ACTUAL API response shape (not name/mobile/line1/
// line2 like before). Fields commonly come back null for legacy rows.
// ---------------------------------------------------------------------------

interface Address {
  ad_id: number;
  user_id?: number;
  full_name: string | null;
  phone: string | null;
  city: string;
  state: string;
  pincode: string;
  house_no: string;
  type?: string | null;
  stree_address: string;
  landmark?: string | null;
  is_default: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

interface AddressPayload {
  full_name: string;
  phone: string;
  house_no: string;
  stree_address: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}

// Location-only — name/phone live separately in ContactInfo since the API
// stores them inconsistently (often null) per-address, not per-contact.
interface AddressForm {
  houseNo: string; // flat / house / floor
  street: string; // area / street / locality
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}

interface PrescriptionInfo {
  doctorName: string;
  hospitalName: string;
}

interface ContactInfo {
  name: string;
  phone: string;
}

const emptyAddressForm: AddressForm = {
  houseNo: "",
  street: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

const emptyContact: ContactInfo = { name: "", phone: "" };
const emptyPrescriptionInfo: PrescriptionInfo = { doctorName: "", hospitalName: "" };

function locationValid(a: AddressForm): boolean {
  return !!(a.houseNo.trim() && a.street.trim() && a.city.trim() && a.pincode.trim().length === 6);
}

function contactValid(c: ContactInfo): boolean {
  return !!(c.name.trim() && c.phone.replace(/\D/g, "").length >= 10);
}

function savedToForm(a: Address): AddressForm {
  return {
    houseNo: a.house_no ?? "",
    street: a.stree_address ?? "",
    landmark: a.landmark ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    pincode: a.pincode ?? "",
  };
}

function formToPayload(f: AddressForm, c: ContactInfo): AddressPayload {
  return {
    full_name: c.name,
    phone: c.phone,
    house_no: f.houseNo,
    stree_address: f.street,
    landmark: f.landmark,
    city: f.city,
    state: f.state || f.city,
    pincode: f.pincode,
  };
}

function dedupeAddresses(list: Address[]): Address[] {
  const seen = new Map<string, Address>();
  for (const a of list) {
    const key = `${(a.house_no ?? "").trim().toLowerCase()}|${(a.stree_address ?? "").trim().toLowerCase()}|${a.pincode ?? ""}`;
    const existing = seen.get(key);
    if (!existing || new Date(a.updatedAt ?? 0).getTime() > new Date(existing.updatedAt ?? 0).getTime()) {
      seen.set(key, a);
    }
  }
  return Array.from(seen.values());
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartSubtotal, cartTax, cartTotal, needsPrescription, clearCart, loadingCart } = useStore();

  const [step, setStep] = useState(0);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [paymentId, setPaymentId] = useState("card");
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // -- Coupon (carried over from the cart page, not re-entered here) --------
  const [appliedCoupon, setAppliedCoupon] = useState<StoredCoupon | null>(null);
  useEffect(() => {
    setAppliedCoupon(readStoredCoupon());
  }, []);
  const couponDiscount = appliedCoupon?.discount ?? 0;

  // -- Address book -----------------------------------------------------------
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [addressBusyId, setAddressBusyId] = useState<number | null>(null);
  const [showAllAddresses, setShowAllAddresses] = useState(false);

  const [billing, setBilling] = useState<AddressForm>(emptyAddressForm);
  const [contact, setContact] = useState<ContactInfo>(emptyContact);
  const [prescriptionInfo, setPrescriptionInfo] = useState<PrescriptionInfo>(emptyPrescriptionInfo);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);

  // -- Shipping (separate from billing when toggled off) ----------------------
  const [shipSameAsBilling, setShipSameAsBilling] = useState(true);
  const [shipping, setShipping] = useState<AddressForm>(emptyAddressForm);
  const [shipContact, setShipContact] = useState<ContactInfo>(emptyContact);

  const dedupedAddresses = useMemo(() => dedupeAddresses(savedAddresses), [savedAddresses]);
  const visibleAddresses = useMemo(
    () => (showAllAddresses ? dedupedAddresses : dedupedAddresses.slice(0, ADDRESS_PREVIEW_COUNT)),
    [dedupedAddresses, showAllAddresses]
  );
  const hiddenAddressCount = dedupedAddresses.length - visibleAddresses.length;

  // Fetches the address list from the API and syncs it into state. Used both
  // on initial load and after create/update so the UI always reflects what's
  // actually saved server-side (no more manual "refresh karna padta hai").
  const fetchAddresses = useCallback(async (): Promise<Address[]> => {
    const data = await addressApi.list();
    const list: Address[] = Array.isArray(data) ? data : [];
    setSavedAddresses(list);
    return list;
  }, []);

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const list = await fetchAddresses();
      const deduped = dedupeAddresses(list);
      if (deduped.length > 0) {
        const def = deduped.find((a) => !!a.is_default) ?? deduped[0];
        setSelectedAddressId(def.ad_id);
        setBilling(savedToForm(def));
        if (def.full_name || def.phone) {
          setContact({ name: def.full_name ?? "", phone: def.phone ?? "" });
        }
      } else {
        setShowAddressForm(true);
      }
    } catch {
      setShowAddressForm(true);
    } finally {
      setLoadingAddresses(false);
    }
  }, [fetchAddresses]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const selectSavedAddress = (a: Address) => {
    setSelectedAddressId(a.ad_id);
    setBilling(savedToForm(a));
    // Only overwrite contact if this address actually has one saved — don't
    // wipe out what the user already typed into the Contact block.
    if (a.full_name || a.phone) {
      setContact({ name: a.full_name ?? "", phone: a.phone ?? "" });
    }
    setShowAddressForm(false);
  };

  const openNewAddressForm = () => {
    setEditingAddressId(null);
    setBilling(emptyAddressForm);
    setSelectedAddressId(null);
    setAddressFormError(null);
    setShowAddressForm(true);
  };

  const openEditAddressForm = (a: Address) => {
    setEditingAddressId(a.ad_id);
    setBilling(savedToForm(a));
    setAddressFormError(null);
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!contactValid(contact)) {
      setAddressFormError("Name aur 10-digit phone number bharo (Contact Details section).");
      return;
    }
    if (!locationValid(billing)) {
      setAddressFormError("House/flat, street, city, aur 6-digit pincode bharo.");
      return;
    }
    setSavingAddress(true);
    setAddressFormError(null);

    const payload = formToPayload(billing, contact);
    const wasEditingId = editingAddressId;

    try {
      if (wasEditingId != null) {
        await addressApi.update(wasEditingId, payload);
      } else {
        await addressApi.create(payload);
      }

      // Re-hit the API instead of patching local state — keeps this in sync
      // with whatever the backend actually persisted (ids, normalization, etc).
      const list = await fetchAddresses();
      const deduped = dedupeAddresses(list);
      const match =
        wasEditingId != null
          ? deduped.find((a) => a.ad_id === wasEditingId)
          : deduped.find(
              (a) =>
                (a.house_no ?? "") === billing.houseNo &&
                (a.stree_address ?? "") === billing.street &&
                a.pincode === billing.pincode
            );

      if (match) {
        setSelectedAddressId(match.ad_id);
        setBilling(savedToForm(match));
      }
      setShowAddressForm(false);
    } catch (error) {
      setAddressFormError(error instanceof ApiError ? error.message : "Address save nahi hui");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (a: Address) => {
    setAddressBusyId(a.ad_id);
    try {
      await addressApi.remove(a.ad_id);
      setSavedAddresses((prev) => prev.filter((x) => x.ad_id !== a.ad_id));
      if (selectedAddressId === a.ad_id) {
        setSelectedAddressId(null);
        setBilling(emptyAddressForm);
        setShowAddressForm(true);
      }
    } catch {
      // swallow — keep list as-is, user can retry
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleSetDefault = async (a: Address) => {
    setAddressBusyId(a.ad_id);
    try {
      await addressApi.setDefault(a.ad_id);
      setSavedAddresses((prev) => prev.map((x) => ({ ...x, is_default: x.ad_id === a.ad_id ? 1 : 0 })));
    } catch {
      // swallow — non-critical, user can retry
    } finally {
      setAddressBusyId(null);
    }
  };

  // -- Order placement ----------------------------------------------------------

  const deliveryFee = cartSubtotal > 499 ? 0 : 49;
  const total = cartTotal - couponDiscount + deliveryFee;

  const billingValid = contactValid(contact) && locationValid(billing);
  const shippingValid = shipSameAsBilling || (contactValid(shipContact) && locationValid(shipping));
  const addressStepValid = billingValid && shippingValid && !showAddressForm;

  const selectedPaymentMode = PAYMENT_METHODS.find((p) => p.id === paymentId)?.mode ?? "cod";

  async function placeOrder() {
    setPlacing(true);
    setOrderError(null);

    const effectiveShipping = shipSameAsBilling ? billing : shipping;
    const effectiveShipContact = shipSameAsBilling ? contact : shipContact;
    const billingLine = `${billing.houseNo}, ${billing.street}`;
    const shippingLine = `${effectiveShipping.houseNo}, ${effectiveShipping.street}, ${effectiveShipping.city} - ${effectiveShipping.pincode}`;

    try {
      const result = await orderApi.checkout({
        customer_name: contact.name,
        customer_phone: contact.phone,
        customer_address: billingLine,
        customer_city: billing.city,
        customer_pincode: billing.pincode,
        customer_country: "India",

        customer_shipping_name: effectiveShipContact.name,
        customer_shipping_phone: effectiveShipContact.phone,
        customer_shipping_address: shippingLine,
        customer_shipping_city: effectiveShipping.city,
        customer_shipping_pincode: effectiveShipping.pincode,
        customer_shipping_country: "India",

        // NOTE: add doctor_name/hospital_name/coupon_code to the
        // OrderCheckoutPayload type in lib/api if TS complains — these
        // aren't part of the address record.
        doctor_name: prescriptionInfo.doctorName || undefined,
        hospital_name: prescriptionInfo.hospitalName || undefined,
        coupon_code: appliedCoupon?.code || undefined,

        payment_mode: selectedPaymentMode,
      });

      if (!result) throw new ApiError("Order place nahi ho paya", 0);

      if (selectedPaymentMode === "online" && result.razorpay) {
        await handleRazorpayPayment(result.razorpay, result.order_id);
      } else {
        clearStoredCoupon();
        await clearCart();
        router.push(`/checkout/success?order_id=${result.order_id}`);
      }
    } catch (error) {
      setOrderError(error instanceof ApiError ? error.message : "Order place karte waqt error aaya");
    } finally {
      setPlacing(false);
    }
  }

  async function handleRazorpayPayment(razorpay: RazorpayOrderInfo, orderId: number | string) {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setOrderError("Payment gateway load nahi ho paya. Internet check karo.");
      return;
    }

    const rzp = new window.Razorpay({
      key: razorpay.key_id,
      order_id: razorpay.order_id,
      amount: razorpay.amount,
      currency: razorpay.currency,
      name: "OncoHealthMart",
      description: `Order #${orderId}`,
      prefill: {
        name: contact.name,
        contact: contact.phone,
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await orderApi.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          clearStoredCoupon();
          await clearCart();
          router.push(`/checkout/success?order_id=${orderId}`);
        } catch (error) {
          setOrderError(
            error instanceof ApiError ? error.message : "Payment verify nahi ho paya. Support se contact karo."
          );
        }
      },
      modal: {
        ondismiss: () => {
          setOrderError("Payment cancel kar diya gaya. Order pending hai — dobara try karo.");
        },
      },
      theme: { color: "#2563eb" },
    });

    rzp.open();
  }

  if (loadingCart) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <Loader2 size={28} className="animate-spin text-[var(--blue-500)]" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-[var(--ink-soft)]">Your cart is empty. Add some products before checking out.</p>
        <Button href="/category/health-essentials" className="mt-6">
          Browse Medicines
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--ink)]">Checkout</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Complete your order in 4 simple steps</p>
        </div>

        {/* step indicator */}
        <div className="flex items-start gap-2 sm:gap-6">
          {STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i];
            const state = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <Fragment key={s}>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      state === "active"
                        ? "bg-[var(--blue-500)] text-white"
                        : state === "done"
                          ? "bg-[var(--mint-500)] text-white"
                          : "bg-black/10 text-[var(--ink-soft)]"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border-2",
                      state === "active"
                        ? "border-[var(--blue-500)] bg-[var(--blue-50)] text-[var(--blue-500)]"
                        : state === "done"
                          ? "border-[var(--mint-500)] bg-[var(--mint-500)]/10 text-[var(--mint-500)]"
                          : "border-black/10 bg-black/[0.02] text-[var(--ink-soft)]"
                    )}
                  >
                    <Icon size={22} />
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:block",
                      state === "active" ? "text-[var(--blue-500)]" : "text-[var(--ink-soft)]"
                    )}
                  >
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mt-2.5 h-0.5 w-6 shrink-0 border-t-2 border-dashed border-black/10 sm:w-14" />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
                    <MapPin size={19} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">Billing Address</p>
                    <p className="text-xs text-[var(--ink-soft)]">Select or add a billing address</p>
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 rounded-[var(--radius-sm)] border border-[var(--line)] bg-black/[0.015] p-4 sm:grid-cols-2 sm:p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
                    <User size={15} className="text-[var(--ink-soft)]" /> Contact Details
                  </p>
                  <Field label="Full Name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} />
                  <Field label="Phone Number" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
                </div>

                {needsPrescription && (
                  <div className="mb-5 grid grid-cols-1 gap-4 rounded-[var(--radius-sm)] border border-[var(--line)] bg-black/[0.015] p-4 sm:grid-cols-2 sm:p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
                      <ClipboardList size={15} className="text-[var(--ink-soft)]" /> Prescription Details{" "}
                      <span className="font-normal text-[var(--ink-soft)]">(Optional)</span>
                    </p>
                    <Field
                      label="Doctor Name (optional)"
                      value={prescriptionInfo.doctorName}
                      onChange={(v) => setPrescriptionInfo({ ...prescriptionInfo, doctorName: v })}
                    />
                    <Field
                      label="Hospital Name (optional)"
                      value={prescriptionInfo.hospitalName}
                      onChange={(v) => setPrescriptionInfo({ ...prescriptionInfo, hospitalName: v })}
                    />
                  </div>
                )}

                {loadingAddresses ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-[var(--ink-soft)]">
                    <Loader2 size={16} className="animate-spin" /> Loading saved addresses...
                  </div>
                ) : (
                  <>
                    {dedupedAddresses.length > 0 && (
                      <div className="mb-4 space-y-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                          <Bookmark size={15} className="text-[var(--ink-soft)]" /> Saved Addresses
                        </p>
                        {visibleAddresses.map((a) => {
                          const isSelected = selectedAddressId === a.ad_id && !showAddressForm;
                          const isBusy = addressBusyId === a.ad_id;
                          const isDefault = !!a.is_default;
                          return (
                            <div
                              key={a.ad_id}
                              onClick={() => !isBusy && selectSavedAddress(a)}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-4 transition-colors",
                                isSelected
                                  ? "border-[var(--blue-500)] bg-[var(--blue-50)]"
                                  : "border-[var(--line)] hover:border-[var(--ink-soft)]",
                                isBusy && "pointer-events-none opacity-50"
                              )}
                            >
                              <div
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                  isSelected ? "border-[var(--blue-500)]" : "border-[var(--line)]"
                                )}
                              >
                                {isSelected && <div className="h-2 w-2 rounded-full bg-[var(--blue-500)]" />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-[var(--ink)]">
                                    {a.full_name || "Saved address"}
                                  </span>
                                  {isDefault && (
                                    <span className="flex items-center gap-1 rounded-full bg-[#FFF4E0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#B45309]">
                                      <Star size={9} className="fill-current" /> Default
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-sm text-[var(--ink-soft)]">
                                  {a.house_no}
                                  {a.house_no && a.stree_address ? ", " : ""}
                                  {a.stree_address}
                                  {a.pincode ? ` - ${a.pincode}` : ""}
                                </p>
                                {a.phone && <p className="text-xs text-[var(--ink-soft)]">{a.phone}</p>}
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                {isBusy ? (
                                  <Loader2 size={14} className="animate-spin text-[var(--ink-soft)]" />
                                ) : (
                                  <>
                                    {!isDefault && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetDefault(a);
                                        }}
                                        title="Set as default"
                                        className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--ink)]"
                                      >
                                        <Star size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditAddressForm(a);
                                      }}
                                      title="Edit"
                                      className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--ink)]"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAddress(a);
                                      }}
                                      title="Delete"
                                      className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--coral-500)]"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {hiddenAddressCount > 0 && (
                          <button
                            onClick={() => setShowAllAddresses(true)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2 text-sm font-medium text-[var(--blue-500)] hover:underline"
                          >
                            <ChevronDown size={14} /> Show {hiddenAddressCount} more address
                            {hiddenAddressCount > 1 ? "es" : ""}
                          </button>
                        )}
                        {showAllAddresses && dedupedAddresses.length > ADDRESS_PREVIEW_COUNT && (
                          <button
                            onClick={() => setShowAllAddresses(false)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2 text-sm font-medium text-[var(--ink-soft)] hover:underline"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}

                    {!showAddressForm && (
                      <button
                        onClick={openNewAddressForm}
                        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] py-3 text-sm font-semibold text-[var(--blue-500)] hover:border-[var(--blue-500)] hover:bg-[var(--blue-50)]"
                      >
                        <Plus size={15} /> Add New Address
                      </button>
                    )}

                    <AnimatePresence>
                      {showAddressForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--blue-50)]/30 p-4 sm:p-5">
                            <div className="mb-4 flex items-center justify-between">
                              <p className="text-sm font-semibold text-[var(--ink)]">
                                {editingAddressId != null ? "Edit Address" : "New Address"}
                              </p>
                              {dedupedAddresses.length > 0 && (
                                <button
                                  onClick={() => {
                                    setShowAddressForm(false);
                                    setAddressFormError(null);
                                  }}
                                  className="text-[var(--ink-soft)] hover:text-[var(--ink)]"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <Field
                                label="House / Flat / Floor"
                                value={billing.houseNo}
                                onChange={(v) => setBilling({ ...billing, houseNo: v })}
                              />
                              <Field
                                label="Street / Area / Locality"
                                value={billing.street}
                                onChange={(v) => setBilling({ ...billing, street: v })}
                              />
                              <Field
                                label="Landmark (optional)"
                                value={billing.landmark}
                                onChange={(v) => setBilling({ ...billing, landmark: v })}
                                className="sm:col-span-2"
                              />
                              <Field label="City" value={billing.city} onChange={(v) => setBilling({ ...billing, city: v })} />
                              <Field label="State" value={billing.state} onChange={(v) => setBilling({ ...billing, state: v })} />
                              <Field label="Pincode" value={billing.pincode} onChange={(v) => setBilling({ ...billing, pincode: v })} />
                            </div>

                            {addressFormError && (
                              <p className="mt-3 text-xs font-medium text-[var(--coral-500)]">{addressFormError}</p>
                            )}

                            <label className="mt-4 flex items-center gap-2 text-xs text-[var(--ink-soft)]">
                              <input
                                type="checkbox"
                                checked={saveAddress}
                                onChange={(e) => setSaveAddress(e.target.checked)}
                                className="h-4 w-4 rounded border-[var(--line)] accent-[var(--blue-500)]"
                              />
                              Save this address to my account
                            </label>

                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                onClick={handleSaveAddress}
                                disabled={savingAddress}
                                className="flex items-center gap-2 rounded-full bg-[var(--blue-500)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue-600)] disabled:opacity-50"
                              >
                                {savingAddress && <Loader2 size={14} className="animate-spin" />}
                                {editingAddressId != null ? "Update Address" : saveAddress ? "Save & Use" : "Use This Address"}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Shipping same-as-billing */}
                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={shipSameAsBilling}
                      onChange={(e) => setShipSameAsBilling(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--line)] accent-[var(--blue-500)]"
                    />
                    Shipping address same as billing
                  </label>

                  <AnimatePresence>
                    {!shipSameAsBilling && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-1 gap-4 rounded-[var(--radius-sm)] border border-[var(--line)] p-4 sm:grid-cols-2 sm:p-5">
                            <p className="text-sm font-semibold text-[var(--ink)] sm:col-span-2">
                              Shipping Contact
                            </p>
                            <Field
                              label="Full Name"
                              value={shipContact.name}
                              onChange={(v) => setShipContact({ ...shipContact, name: v })}
                            />
                            <Field
                              label="Phone Number"
                              value={shipContact.phone}
                              onChange={(v) => setShipContact({ ...shipContact, phone: v })}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 rounded-[var(--radius-sm)] border border-[var(--line)] p-4 sm:grid-cols-2 sm:p-5">
                            <Field
                              label="House / Flat / Floor"
                              value={shipping.houseNo}
                              onChange={(v) => setShipping({ ...shipping, houseNo: v })}
                            />
                            <Field
                              label="Street / Area / Locality"
                              value={shipping.street}
                              onChange={(v) => setShipping({ ...shipping, street: v })}
                            />
                            <Field
                              label="Landmark (optional)"
                              value={shipping.landmark}
                              onChange={(v) => setShipping({ ...shipping, landmark: v })}
                              className="sm:col-span-2"
                            />
                            <Field label="City" value={shipping.city} onChange={(v) => setShipping({ ...shipping, city: v })} />
                            <Field label="State" value={shipping.state} onChange={(v) => setShipping({ ...shipping, state: v })} />
                            <Field label="Pincode" value={shipping.pincode} onChange={(v) => setShipping({ ...shipping, pincode: v })} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="delivery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--mint-500)]/10 text-[var(--mint-500)]">
                    <Truck size={19} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">Choose a Delivery Slot</p>
                    <p className="text-xs text-[var(--ink-soft)]">Pick a window that works for you</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-5 py-4 text-left text-sm",
                        slot === s ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                      )}
                    >
                      {s}
                      {slot === s && <CheckCircle2 size={16} className="text-[var(--blue-500)]" />}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[var(--ink-soft)]">
                  Slot preference note ki tarah rakha jaata hai — final delivery time courier assignment pe depend
                  karta hai.
                </p>
                {needsPrescription && (
                  <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[#FCE1B8] bg-[#FFF8EC] p-4 text-sm text-[#8A5A0C]">
                    <FileWarning size={17} className="mt-0.5 shrink-0" />
                    Your order contains prescription items — our pharmacist may call to confirm before dispatch.
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--coral-500)]/10 text-[var(--coral-500)]">
                    <CreditCard size={19} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">Payment Method</p>
                    <p className="text-xs text-[var(--ink-soft)]">Choose how you&apos;d like to pay</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {PAYMENT_METHODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPaymentId(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-5 py-4 text-left text-sm font-medium",
                        paymentId === p.id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                      )}
                    >
                      <p.icon size={17} />
                      {p.label}
                      {paymentId === p.id && <CheckCircle2 size={16} className="ml-auto text-[var(--blue-500)]" />}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--ink-soft)]">
                  Card / UPI Razorpay ke through process hote hain — payment window agle step ke baad khulegi.
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
                    <FileText size={19} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">Review Your Order</p>
                    <p className="text-xs text-[var(--ink-soft)]">Double-check everything before you place it</p>
                  </div>
                </div>
                <div className="mb-5 space-y-3 text-sm">
                  <SummaryRow
                    label="Billing to"
                    value={`${contact.name}, ${billing.houseNo}, ${billing.street}, ${billing.city} - ${billing.pincode}`}
                  />
                  <SummaryRow
                    label="Shipping to"
                    value={
                      shipSameAsBilling
                        ? "Same as billing"
                        : `${shipContact.name}, ${shipping.houseNo}, ${shipping.street}, ${shipping.city} - ${shipping.pincode}`
                    }
                  />
                  <SummaryRow label="Phone" value={contact.phone} />
                  <SummaryRow label="Delivery slot" value={slot} />
                  <SummaryRow
                    label="Payment method"
                    value={PAYMENT_METHODS.find((p) => p.id === paymentId)?.label ?? ""}
                  />
                  {appliedCoupon && <SummaryRow label="Coupon" value={appliedCoupon.code} />}
                </div>
                <div className="divide-y divide-[var(--line)] rounded-[var(--radius-sm)] border border-[var(--line)]">
                  {cart.map((item) => (
                    <div key={item.cart_id} className="flex justify-between px-4 py-3 text-sm">
                      <span>
                        {item.product_name} × {item.product_quantity}
                      </span>
                      <span className="font-mono-nums">{formatINR(item.line_total)}</span>
                    </div>
                  ))}
                </div>

                {orderError && (
                  <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[#F8C9C9] bg-[#FFF2F2] p-3 text-sm text-[var(--coral-500)]">
                    <FileWarning size={16} className="mt-0.5 shrink-0" />
                    {orderError}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-fit space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
                <ShoppingBag size={19} />
              </span>
              <div>
                <p className="font-semibold text-[var(--ink)]">Order Summary</p>
                <p className="text-xs text-[var(--ink-soft)]">
                  {cart.length} item{cart.length > 1 ? "s" : ""} in your cart
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm font-mono-nums">
              <div className="flex justify-between text-[var(--ink-soft)]">
                <span>Subtotal</span>
                <span>{formatINR(cartSubtotal)}</span>
              </div>
              {cartTax > 0 && (
                <div className="flex justify-between text-[var(--ink-soft)]">
                  <span>GST</span>
                  <span>{formatINR(cartTax)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-[var(--mint-600)]">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span>-{formatINR(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--ink-soft)]">
                <span>Delivery</span>
                <span>{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]">
                <span>Total</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>

            {couponDiscount > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--mint-600)]/10 px-4 py-3 text-sm font-medium text-[var(--mint-600)]">
                <Sparkles size={15} />
                You&apos;re saving {formatINR(couponDiscount)} with &quot;{appliedCoupon?.code}&quot;
              </div>
            )}

            <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 p-4">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--blue-500)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--blue-500)]">Safe &amp; Secure Checkout</p>
                <p className="text-xs text-[var(--ink-soft)]">
                  Your information is protected with 256-bit SSL encryption.
                </p>
              </div>
            </div>

            {orderError && step === STEPS.length - 1 && (
              <p className="mt-3 text-xs font-medium text-[var(--coral-500)]">{orderError}</p>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !addressStepValid}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--blue-500)] to-[var(--blue-600)] py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {step === 0 && <Lock size={14} />}
                {STEP_CTA_LABEL[step]}
                <ArrowRight size={15} />
              </button>
            ) : (
              <Button variant="mint" className="mt-6 w-full" onClick={placeOrder} disabled={placing}>
                {placing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" /> Placing order...
                  </span>
                ) : (
                  "Place Order"
                )}
              </Button>
            )}

            {step === 0 ? (
              <Button href="/cart" variant="outline" size="md" className="mt-3 w-full" icon={<ArrowLeft size={15} />}>
                Back to Cart
              </Button>
            ) : (
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={placing}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] py-2.5 text-sm font-semibold text-[var(--ink-soft)] hover:bg-black/[0.02] disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Back
              </button>
            )}
          </div>

          {/* trust bar */}
          <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-5 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { icon: BadgeCheck, label: "100% Genuine Medicines" },
              { icon: Truck, label: "Fast Delivery Across India" },
              { icon: Headphones, label: "24x7 Customer Support" },
              { icon: RotateCcw, label: "Easy Returns & Refunds" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mint-600)]/10 text-[var(--mint-600)]">
                  <Icon size={16} />
                </span>
                <p className="text-[11px] font-medium leading-tight text-[var(--ink-soft)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-4 text-sm outline-none focus:border-[var(--blue-500)]"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-[var(--ink-soft)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}