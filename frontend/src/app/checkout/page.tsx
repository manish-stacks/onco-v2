"use client"
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, Plus, CreditCard, Wallet, Truck, FileWarning, Loader2, CheckCircle2, Stethoscope,
  Pencil, Trash2, UploadCloud, X, AlertCircle, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineOtpVerify } from "@/components/auth/InlineOtpVerify";
import {
  addressApi, orderApi, prescriptionApi, authApi, cartApi, mediaUrl, ApiError,
  type Address, type CheckoutPayload, type CheckoutResult, type PaymentGatewayOption,
} from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { submitToPayu } from "@/lib/payu";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import { clearAppliedCoupon, getAppliedCoupon, saveAppliedCoupon } from "@/lib/coupon";
import type { Prescription } from "@/types";

const EMPTY_ADDRESS: Address = {
  full_name: "", phone: "", house_no: "", stree_address: "", landmark: "", city: "", state: "", pincode: "", type: "Home",
};

/** Turn the field-wise errors the server returns into a simple map */
function toFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiError && err.errors) {
    Object.entries(err.errors).forEach(([k, v]) => {
      out[k] = Array.isArray(v) ? String(v[0]) : String(v);
    });
  }
  return out;
}

/** Client-side check, so the user sees a clear error before we hit the server */
function validateAddress(a: Address): Record<string, string> {
  const e: Record<string, string> = {};
  if (!a.full_name?.trim() || a.full_name.trim().length < 3) e.full_name = "Please enter the full name (at least 3 characters)";
  if (!/^[6-9]\d{9}$/.test(String(a.phone || "").replace(/\D/g, "").slice(-10))) e.phone = "Please enter a valid 10-digit mobile number";
  if (!a.house_no?.trim()) e.house_no = "House / Flat number is required";
  if (!a.stree_address?.trim() || a.stree_address.trim().length < 3) e.stree_address = "Please enter the street address";
  if (!a.city?.trim()) e.city = "City is required";
  if (!a.state?.trim()) e.state = "State is required";
  if (!/^\d{6}$/.test(String(a.pincode || ""))) e.pincode = "Please enter a valid 6-digit PIN code";
  return e;
}

const FIELD_CLASS = "h-11 w-full rounded-[var(--radius-sm)] border px-4 text-sm outline-none transition";

function FieldInput({
  label, value, onChange, error, placeholder, className = "", type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; placeholder?: string; className?: string; type?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder || label}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_CLASS} ${error ? "border-[var(--coral-500)] bg-[#FFF7F5]" : "border-[var(--line)] focus:border-[var(--blue-500)]"}`}
      />
      {error && (
        <p className="mt-1 flex items-start gap-1 text-xs text-[var(--coral-500)]">
          <AlertCircle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isLoggedIn, user, refresh } = useAuth();

  const prescriptionIdFromUrl = params.get("prescription_id");
  const { cartItems, summary, refreshCart } = useStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [addressDraft, setAddressDraft] = useState<Address>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | number | null>(null);

  // New prescription upload, straight from the checkout page
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // Prescription: either pick a saved one OR upload a new one — never both, to
  // avoid the "do I need to do both?" confusion.
  const [prescMode, setPrescMode] = useState<"saved" | "new">("saved");
  const [viewRx, setViewRx] = useState<Prescription | null>(null);
  const [uploading, setUploading] = useState(false);
  const [prescErrors, setPrescErrors] = useState<Record<string, string>>({});

  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [comment, setComment] = useState("");

  const [shippingSame, setShippingSame] = useState(true);
  const [shippingAddress, setShippingAddress] = useState<Address>(EMPTY_ADDRESS);

  // Coupon — the code applied on the cart page has to travel with the order,
  // otherwise the backend creates the order without any discount.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponError, setCouponError] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [paymentMode, setPaymentMode] = useState<"cod" | "online">("cod");
  const [gateways, setGateways] = useState<PaymentGatewayOption[]>([]);
  const [gateway, setGateway] = useState<"razorpay" | "payu">("razorpay");
  const [codEnabled, setCodEnabled] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which gateways are live — enabled/disabled from admin Settings.
  // Nothing here is hardcoded.
  useEffect(() => {
    orderApi
      .gateways()
      .then((res) => {
        if (!res) return;
        const list = res.available || [];
        setGateways(list);
        // Preselect the admin's default gateway, but never one that is disabled
        const preferred = list.some((g) => g.id === res.default) ? res.default : list[0]?.id;
        if (preferred) setGateway(preferred);
        setCodEnabled(res.cod_enabled !== false);
      })
      .catch(() => {
        setGateways([{ id: "razorpay", label: "Razorpay", type: "sdk" }]);
        setCodEnabled(true);
      });
  }, []);

  // COD is available only when the admin has turned it on AND every cart item is COD-eligible
  const codAvailable = codEnabled && !!summary?.cod_allowed;

  // Re-validate the stored coupon against the current cart. Totals may have
  // changed since it was applied, so we never trust the saved discount blindly.
  useEffect(() => {
    if (!isLoggedIn) return;
    const saved = getAppliedCoupon();
    if (!saved) return;
    setCouponInput(saved.code);
    cartApi
      .applyCoupon<{ coupon_code: string; discount: number }>(saved.code)
      .then((res) => {
        const value = Number(res?.discount) || 0;
        setAppliedCoupon(saved.code);
        setDiscount(value);
        saveAppliedCoupon(saved.code, value);
      })
      .catch((err) => {
        clearAppliedCoupon();
        setAppliedCoupon(null);
        setDiscount(0);
        setCouponError(true);
        setCouponMsg(err instanceof ApiError ? err.message : "This coupon is no longer valid");
      });
  }, [isLoggedIn, summary?.subtotal]);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponMsg(null);
    setCouponError(false);
    try {
      const res = await cartApi.applyCoupon<{ coupon_code: string; discount: number }>(code);
      const value = Number(res?.discount) || 0;
      saveAppliedCoupon(code, value);
      setAppliedCoupon(code);
      setDiscount(value);
      setCouponMsg(`Coupon applied — ${formatINR(value)} off`);
    } catch (err) {
      clearAppliedCoupon();
      setAppliedCoupon(null);
      setDiscount(0);
      setCouponError(true);
      setCouponMsg(err instanceof ApiError ? err.message : "Could not apply this coupon");
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    clearAppliedCoupon();
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponInput("");
    setCouponMsg(null);
    setCouponError(false);
  }

  useEffect(() => {
    setPaymentMode(codAvailable ? "cod" : "online");
  }, [codAvailable]);

  const loadPrescriptions = useMemo(() => async (preferId?: string | number | null) => {
    const [list, fresh] = await Promise.all([
      prescriptionApi.list<Prescription[]>({ limit: 20 }).then((res) => res?.data ?? []).catch(() => []),
      preferId ? prescriptionApi.detail<Prescription>(preferId).catch(() => null) : Promise.resolve(null),
    ]);
    let merged = list;
    if (fresh && !list.some((p) => String(p.prescription_id) === String(fresh.prescription_id))) {
      merged = [fresh, ...list];
    }
    setPrescriptions(merged);
    return merged;
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    addressApi.list<Address[]>().then((data) => {
      setAddresses(data ?? []);
      const def = (data ?? []).find((a) => a.is_default) ?? data?.[0];
      if (def?.ad_id) setSelectedAddressId(def.ad_id);
    }).catch(() => setAddresses([]));

    if (summary?.requires_prescription) {
      loadPrescriptions(prescriptionIdFromUrl).then((merged) => {
        const pick = prescriptionIdFromUrl && merged.some((p) => String(p.prescription_id) === String(prescriptionIdFromUrl))
          ? prescriptionIdFromUrl
          : merged[0]?.prescription_id ?? null;
        if (pick) setSelectedPrescriptionId(pick);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, summary?.requires_prescription, prescriptionIdFromUrl]);

  // As soon as a prescription is selected, auto-fill patient / doctor / hospital
  useEffect(() => {
    if (!selectedPrescriptionId) return;
    const p = prescriptions.find((x) => String(x.prescription_id) === String(selectedPrescriptionId));
    if (!p) return;
    setPatientName(p.patient_name || "");
    setDoctorName(p.doctor_name || "");
    setHospitalName(p.hospital_name || "");
  }, [selectedPrescriptionId, prescriptions]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.ad_id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  function addressLine(a: Address) {
    return [a.house_no, a.stree_address, a.landmark].filter(Boolean).join(", ");
  }

  // ---------------------------------------------------------------- addresses
  function openNewAddress() {
    setEditingId(null);
    setAddressDraft(EMPTY_ADDRESS);
    setAddressErrors({});
    setShowAddressForm(true);
  }

  function openEditAddress(a: Address) {
    setEditingId(a.ad_id ?? null);
    setAddressDraft({ ...EMPTY_ADDRESS, ...a });
    setAddressErrors({});
    setShowAddressForm(true);
  }

  function closeAddressForm() {
    setShowAddressForm(false);
    setEditingId(null);
    setAddressErrors({});
    setAddressDraft(EMPTY_ADDRESS);
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const local = validateAddress(addressDraft);
    if (Object.keys(local).length) {
      setAddressErrors(local);
      return;
    }

    setSavingAddress(true);
    try {
      if (editingId) {
        await addressApi.update(editingId, addressDraft);
        const list = await addressApi.list<Address[]>();
        setAddresses(list ?? []);
        setSelectedAddressId(editingId);
      } else {
        await addressApi.create<Address>(addressDraft);
        const list = await addressApi.list<Address[]>();
        setAddresses(list ?? []);
        const match = (list ?? []).find(
          (a) => a.stree_address === addressDraft.stree_address && a.pincode === addressDraft.pincode
        );
        setSelectedAddressId(match?.ad_id ?? list?.[list.length - 1]?.ad_id ?? null);
      }
      closeAddressForm();
    } catch (err) {
      const fieldErrors = toFieldErrors(err);
      if (Object.keys(fieldErrors).length) {
        setAddressErrors(fieldErrors);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not save the address");
      }
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleRemoveAddress(adId: string | number) {
    if (!window.confirm("Remove this address?")) return;
    setDeletingId(adId);
    setError(null);
    try {
      await addressApi.remove(adId);
      const list = await addressApi.list<Address[]>();
      setAddresses(list ?? []);
      if (String(selectedAddressId) === String(adId)) {
        setSelectedAddressId(list?.[0]?.ad_id ?? null);
      }
      if (String(editingId) === String(adId)) closeAddressForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the address");
    } finally {
      setDeletingId(null);
    }
  }

  // ------------------------------------------------------------ prescriptions
  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 5);
    setNewFiles(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
    setPrescErrors((e) => ({ ...e, files: "" }));
  }

  function clearPickedFiles() {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setNewFiles([]);
    setPreviews([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUploadPrescription() {
    const e: Record<string, string> = {};
    if (!newFiles.length) e.files = "Please choose at least one prescription image";
    if (!patientName.trim()) e.patient_name = "Patient name is required";
    if (!doctorName.trim()) e.doctor_name = "Doctor name is required";
    if (!hospitalName.trim()) e.hospital_name = "Hospital / clinic name is required";
    setPrescErrors(e);
    if (Object.keys(e).length) return;

    setUploading(true);
    setError(null);
    try {
      const res = await prescriptionApi.upload<{ prescription_id: string | number }>(newFiles, {
        patient_name: patientName.trim(),
        doctor_name: doctorName.trim(),
        hospital_name: hospitalName.trim(),
      });
      clearPickedFiles();
      const merged = await loadPrescriptions(res?.prescription_id ?? null);
      const newId = res?.prescription_id ?? merged[0]?.prescription_id ?? null;
      if (newId) setSelectedPrescriptionId(newId);
      setPrescMode("saved");
    } catch (err) {
      const fieldErrors = toFieldErrors(err);
      if (Object.keys(fieldErrors).length) setPrescErrors(fieldErrors);
      else setError(err instanceof ApiError ? err.message : "Could not upload the prescription");
    } finally {
      setUploading(false);
    }
  }

  // ------------------------------------------------------------------- order
  async function placeOrder() {
    if (!isLoggedIn) return;
    if (!selectedAddress) {
      setError("Please select or add a delivery address.");
      return;
    }
    const addrIssues = validateAddress(selectedAddress);
    if (Object.keys(addrIssues).length) {
      setError(`The selected address is incomplete — ${Object.values(addrIssues)[0]}`);
      openEditAddress(selectedAddress);
      return;
    }
    if (summary?.requires_prescription) {
      if (!selectedPrescriptionId) {
        setError("This order needs a prescription. Please upload or select one.");
        return;
      }
      const missing: Record<string, string> = {};
      if (!patientName.trim()) missing.patient_name = "Patient name is required";
      if (!doctorName.trim()) missing.doctor_name = "Doctor name is required";
      if (!hospitalName.trim()) missing.hospital_name = "Hospital / clinic name is required";
      if (Object.keys(missing).length) {
        setPrescErrors(missing);
        setError("Please fill in the patient, doctor and hospital details.");
        return;
      }
    }
    if (paymentMode === "online" && gateways.length === 0) {
      setError("Online payment is not available right now. Please try Cash on Delivery.");
      return;
    }

    setError(null);
    setPlacing(true);

    if (!user?.customer_name?.trim() && selectedAddress.full_name) {
      authApi
        .updateProfile({ customer_name: selectedAddress.full_name })
        .then(() => refresh())
        .catch(() => { /* non-critical — the order flow continues regardless */ });
    }
    try {
      const payload: CheckoutPayload = {
        customer_name: selectedAddress.full_name,
        customer_phone: selectedAddress.phone,
        customer_address: addressLine(selectedAddress),
        customer_city: selectedAddress.city,
        customer_state: selectedAddress.state,
        customer_pincode: selectedAddress.pincode,
        customer_country: "India",
        shipping_same_as_billing: shippingSame,
        ...(shippingSame
          ? {}
          : {
              customer_shipping_name: shippingAddress.full_name,
              customer_shipping_phone: shippingAddress.phone,
              customer_shipping_address: addressLine(shippingAddress),
              customer_shipping_city: shippingAddress.city,
              customer_shipping_state: shippingAddress.state,
              customer_shipping_pincode: shippingAddress.pincode,
              customer_shipping_country: "India",
            }),
        coupon_code: appliedCoupon || undefined,
        payment_mode: paymentMode,
        payment_gateway: paymentMode === "online" ? gateway : undefined,
        prescription_id: selectedPrescriptionId ?? undefined,
        patient_name: patientName || undefined,
        doctor_name: doctorName || undefined,
        hospital_name: hospitalName || undefined,
        comment: comment || undefined,
      };

      const data = await orderApi.checkout<CheckoutResult>(payload);
      if (!data?.order) throw new ApiError("Could not place order", 500);

      const { order, payment } = data;

      clearAppliedCoupon();

      if (paymentMode === "cod" || !payment) {
        await refreshCart();
        router.push(`/order-success/${order.order_id}`);
        return;
      }

      if (payment.type === "sdk" && payment.gateway === "razorpay" && payment.razorpay) {
        await openRazorpayCheckout({
          session: payment.razorpay,
          description: `Order #${order.databaseOrderID || order.order_id}`,
          onSuccess: async (response) => {
            try {
              await orderApi.verifyPayment(response);
              await refreshCart();
              router.push(`/payment/success?order_id=${order.order_id}`);
            } catch {
              router.push(`/payment/failed?order_id=${order.order_id}&reason=verification_failed`);
            }
          },
          onDismiss: () => router.push(`/payment/failed?order_id=${order.order_id}&reason=payment_cancelled`),
        });
        return;
      }

      if (payment.type === "redirect" && payment.gateway === "payu" && payment.payu) {
        submitToPayu(payment.payu);
        return;
      }

      await refreshCart();
      router.push(`/order-success/${order.order_id}`);
    } catch (err) {
      const fieldErrors = toFieldErrors(err);
      if (Object.keys(fieldErrors).length) {
        setError(Object.values(fieldErrors).join(" · "));
      } else {
        const message = err instanceof ApiError ? err.message : "Could not place order. Please try again.";
        setError(message);
        // A rejected coupon must not block the order — drop it and let them retry
        if (err instanceof ApiError && err.status === 409 && /coupon/i.test(message)) {
          removeCoupon();
          setCouponError(true);
          setCouponMsg(`${message} — the coupon has been removed, please place the order again.`);
        }
      }
    } finally {
      setPlacing(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your cart is empty</h1>
        <Button href="/shop">Browse Medicines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Checkout</h1>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!isLoggedIn ? (
            <InlineOtpVerify onVerified={() => { /* isLoggedIn updates from context */ }} />
          ) : (
            <>
              {/* Address */}
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
                <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <MapPin size={17} className="text-[var(--blue-500)]" /> Delivery Address
                </p>

                <div className="space-y-3">
                  {addresses.length === 0 && !showAddressForm && (
                    <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-soft)]">
                      No saved address yet. Add one to continue.
                    </p>
                  )}

                  {addresses.map((a) => (
                    <div
                      key={a.ad_id}
                      className={`flex items-start gap-3 rounded-[var(--radius-sm)] border p-4 text-sm transition ${
                        selectedAddressId === a.ad_id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1 cursor-pointer"
                        checked={selectedAddressId === a.ad_id}
                        onChange={() => setSelectedAddressId(a.ad_id ?? null)}
                      />
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedAddressId(a.ad_id ?? null)}>
                        <p className="font-semibold text-[var(--ink)]">
                          {a.full_name} · {a.phone}
                          {a.type && <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase">{a.type}</span>}
                        </p>
                        <p className="text-[var(--ink-soft)]">{addressLine(a)}, {a.city}, {a.state} - {a.pincode}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Edit address"
                          onClick={() => openEditAddress(a)}
                          className="rounded-md p-1.5 text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--blue-600)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Remove address"
                          disabled={deletingId === a.ad_id}
                          onClick={() => a.ad_id && handleRemoveAddress(a.ad_id)}
                          className="rounded-md p-1.5 text-[var(--ink-soft)] hover:bg-black/5 hover:text-[var(--coral-500)] disabled:opacity-50"
                        >
                          {deletingId === a.ad_id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {!showAddressForm ? (
                  <button onClick={openNewAddress} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)]">
                    <Plus size={15} /> Add new address
                  </button>
                ) : (
                  <form onSubmit={handleSaveAddress} className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
                    <p className="text-sm font-semibold text-[var(--ink)] sm:col-span-2">
                      {editingId ? "Edit address" : "New address"}
                    </p>
                    <FieldInput label="Full name" value={addressDraft.full_name} error={addressErrors.full_name}
                      onChange={(v) => setAddressDraft({ ...addressDraft, full_name: v })} />
                    <FieldInput label="Mobile number" value={addressDraft.phone} error={addressErrors.phone}
                      onChange={(v) => setAddressDraft({ ...addressDraft, phone: v })} />
                    <FieldInput label="House / Flat no." value={addressDraft.house_no || ""} error={addressErrors.house_no}
                      onChange={(v) => setAddressDraft({ ...addressDraft, house_no: v })} />
                    <FieldInput label="Street address" value={addressDraft.stree_address} error={addressErrors.stree_address}
                      onChange={(v) => setAddressDraft({ ...addressDraft, stree_address: v })} />
                    <FieldInput label="Landmark (optional)" className="sm:col-span-2" value={addressDraft.landmark || ""}
                      onChange={(v) => setAddressDraft({ ...addressDraft, landmark: v })} />
                    <FieldInput label="City" value={addressDraft.city} error={addressErrors.city}
                      onChange={(v) => setAddressDraft({ ...addressDraft, city: v })} />
                    <FieldInput label="State" value={addressDraft.state} error={addressErrors.state}
                      onChange={(v) => setAddressDraft({ ...addressDraft, state: v })} />
                    <FieldInput label="PIN code" value={addressDraft.pincode} error={addressErrors.pincode}
                      onChange={(v) => setAddressDraft({ ...addressDraft, pincode: v })} />
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Address type</label>
                      <select
                        value={addressDraft.type}
                        onChange={(e) => setAddressDraft({ ...addressDraft, type: e.target.value })}
                        className={`${FIELD_CLASS} border-[var(--line)]`}
                      >
                        <option value="Home">Home</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <Button type="submit" size="md" disabled={savingAddress}
                        icon={savingAddress ? <Loader2 size={15} className="animate-spin" /> : undefined}>
                        {savingAddress ? "Saving…" : editingId ? "Update Address" : "Save Address"}
                      </Button>
                      <button type="button" onClick={closeAddressForm} className="text-sm font-medium text-[var(--ink-soft)]">Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Shipping address toggle */}
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 hidden">
                <label className="flex items-center gap-3 text-sm font-medium text-[var(--ink)]">
                  <input type="checkbox" checked={shippingSame} onChange={(e) => setShippingSame(e.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                  Shipping address same as billing
                </label>
                {!shippingSame && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldInput label="Full name" value={shippingAddress.full_name}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, full_name: v })} />
                    <FieldInput label="Mobile number" value={shippingAddress.phone}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, phone: v })} />
                    <FieldInput label="Street address" className="sm:col-span-2" value={shippingAddress.stree_address}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, stree_address: v })} />
                    <FieldInput label="City" value={shippingAddress.city}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, city: v })} />
                    <FieldInput label="State" value={shippingAddress.state}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, state: v })} />
                    <FieldInput label="PIN code" value={shippingAddress.pincode}
                      onChange={(v) => setShippingAddress({ ...shippingAddress, pincode: v })} />
                  </div>
                )}
              </div>

              {/* Prescription */}
              {summary?.requires_prescription && (
                <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
                  <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <FileWarning size={17} className="text-[#8A5A0C]" /> Prescription Required
                  </p>

                  {prescriptions.length > 0 && (
                    <div className="mb-4 inline-flex rounded-[var(--radius-sm)] border border-[var(--line)] p-0.5 text-sm">
                      <button
                        type="button"
                        onClick={() => { setPrescMode("saved"); clearPickedFiles(); }}
                        className={`rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 font-medium ${prescMode === "saved" ? "bg-[var(--blue-500)] text-white" : "text-[var(--ink-soft)]"}`}
                      >
                        Use a saved prescription
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPrescMode("new"); setSelectedPrescriptionId(null); }}
                        className={`rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 font-medium ${prescMode === "new" ? "bg-[var(--blue-500)] text-white" : "text-[var(--ink-soft)]"}`}
                      >
                        Upload a new one
                      </button>
                    </div>
                  )}

                  {prescriptions.length > 0 && prescMode === "saved" && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[var(--ink-soft)]">Select a saved prescription</p>
                      {prescriptions.map((p) => (
                        <label
                          key={p.prescription_id}
                          className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 text-sm ${
                            String(selectedPrescriptionId) === String(p.prescription_id)
                              ? "border-[var(--blue-500)] bg-[var(--blue-50)]"
                              : "border-[var(--line)]"
                          }`}
                        >
                          <input
                            type="radio"
                            checked={String(selectedPrescriptionId) === String(p.prescription_id)}
                            onChange={() => setSelectedPrescriptionId(p.prescription_id)}
                          />
                          {p.images?.[0] && (
                            <Image src={mediaUrl(p.images[0])} alt="prescription" width={40} height={40} className="h-10 w-10 rounded object-cover" />
                          )}
                          <span className="flex-1">
                            <span className="block font-medium">{p.reference_code || `Prescription #${p.prescription_id}`}</span>
                            {(p.patient_name || p.doctor_name) && (
                              <span className="block text-xs text-[var(--ink-soft)]">
                                {[p.patient_name, p.doctor_name && `Dr. ${p.doctor_name}`, p.hospital_name].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            p.status === "Approved" || p.status === "Completed"
                              ? "bg-[var(--mint-50)] text-[var(--mint-600)]"
                              : p.status === "Rejected" || p.status === "Cancelled"
                                ? "bg-[#FFEDEA] text-[var(--coral-500)]"
                                : "bg-[#FFF4E0] text-[#8A5A0C]"
                          }`}>
                            {p.status}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewRx(p); }}
                            className="ml-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--blue-600)] hover:bg-[var(--blue-50)]"
                          >
                            View
                          </button>
                        </label>
                      ))}
                      {selectedPrescriptionId
                        && prescriptions.find((p) => String(p.prescription_id) === String(selectedPrescriptionId))?.status !== "Approved" && (
                        <p className="text-xs text-[var(--ink-soft)]">
                          A pharmacist is still verifying this prescription — the order will be placed with the status
                          &quot;Prescription Pending&quot; until it is approved.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Upload a new prescription right here */}
                  {(prescMode === "new" || prescriptions.length === 0) && (
                  <div className="mt-5 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                      <UploadCloud size={16} className="text-[var(--blue-500)]" /> Upload a new prescription
                    </p>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={(e) => onPickFiles(e.target.files)}
                      className="block w-full text-xs text-[var(--ink-soft)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--blue-50)] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[var(--blue-600)]"
                    />
                    {prescErrors.files && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--coral-500)]">
                        <AlertCircle size={12} /> {prescErrors.files}
                      </p>
                    )}

                    {previews.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {previews.map((src, i) => (
                          <div key={src} className="relative h-20 w-20 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`preview ${i + 1}`} className="h-full w-full object-cover" />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={clearPickedFiles}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] text-[10px] font-medium text-[var(--ink-soft)] hover:text-[var(--coral-500)]"
                        >
                          <X size={14} /> Clear
                        </button>
                      </div>
                    )}

                    <p className="mt-4 text-xs font-medium text-[var(--ink-soft)]">
                      Patient, doctor and hospital details are mandatory for a prescription order.
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FieldInput label="Patient name" value={patientName} error={prescErrors.patient_name}
                        onChange={(v) => { setPatientName(v); setPrescErrors((e) => ({ ...e, patient_name: "" })); }} />
                      <FieldInput label="Doctor name" value={doctorName} error={prescErrors.doctor_name}
                        onChange={(v) => { setDoctorName(v); setPrescErrors((e) => ({ ...e, doctor_name: "" })); }} />
                      <FieldInput label="Hospital / clinic name" className="sm:col-span-2" value={hospitalName} error={prescErrors.hospital_name}
                        onChange={(v) => { setHospitalName(v); setPrescErrors((e) => ({ ...e, hospital_name: "" })); }} />
                    </div>

                    {newFiles.length > 0 && (
                      <Button
                        type="button"
                        size="md"
                        className="mt-4"
                        disabled={uploading}
                        onClick={handleUploadPrescription}
                        icon={uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                      >
                        {uploading ? "Uploading…" : `Upload ${newFiles.length} file(s)`}
                      </Button>
                    )}

                    {prescriptions.length === 0 && newFiles.length === 0 && (
                      <p className="mt-3 text-xs text-[var(--ink-soft)]">
                        Prefer the full upload page?{" "}
                        <Link href="/prescription-upload?redirect=/checkout" className="font-semibold text-[var(--blue-600)]">
                          Open it here
                        </Link>
                      </p>
                    )}
                  </div>
                  )}
                </div>
              )}

              {viewRx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewRx(null)}>
                  <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-md)] bg-white p-5" onClick={(e) => e.stopPropagation()}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-[var(--ink)]">{viewRx.reference_code || `Prescription #${viewRx.prescription_id}`}</p>
                      <button onClick={() => setViewRx(null)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]"><X size={18} /></button>
                    </div>
                    {(viewRx.patient_name || viewRx.doctor_name || viewRx.hospital_name) && (
                      <p className="mb-3 text-xs text-[var(--ink-soft)]">
                        {[viewRx.patient_name, viewRx.doctor_name && `Dr. ${viewRx.doctor_name}`, viewRx.hospital_name].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {(viewRx.images || []).map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={mediaUrl(img)} alt={`prescription ${i + 1}`} className="w-full rounded-[var(--radius-sm)] border border-[var(--line)]" />
                      ))}
                      {(!viewRx.images || viewRx.images.length === 0) && (
                        <p className="text-sm text-[var(--ink-soft)]">No images on this prescription.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Order note */}
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
                <p className="mb-3 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <Stethoscope size={17} className="text-[var(--blue-500)]" /> Order Note (optional)
                </p>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any instructions for delivery or your order..."
                  className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--line)] px-4 py-2.5 text-sm outline-none"
                />
              </div>

              {/* Payment */}
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
                <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                  <CreditCard size={17} className="text-[var(--blue-500)]" /> Payment Method
                </p>
                <div className="space-y-2">
                  {/* One flat list — the customer picks the exact gateway:
                      Razorpay / PayU / Cash on Delivery. Gateways come from
                      admin Settings, so a disabled one never appears here. */}
                  {gateways.map((g) => {
                    const active = paymentMode === "online" && gateway === g.id;
                    return (
                      <label
                        key={g.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-4 text-sm ${active ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          checked={active}
                          onChange={() => { setPaymentMode("online"); setGateway(g.id); }}
                        />
                        <Wallet size={16} className="text-[var(--ink-soft)]" />
                        <span className="font-medium">Pay with {g.label || g.id}</span>
                        <span className="ml-auto text-xs text-[var(--ink-soft)]">
                          UPI / Card / Netbanking
                        </span>
                      </label>
                    );
                  })}

                  {codAvailable && (
                    <label className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-4 text-sm ${paymentMode === "cod" ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}>
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMode === "cod"}
                        onChange={() => setPaymentMode("cod")}
                      />
                      <Truck size={16} className="text-[var(--ink-soft)]" />
                      <span className="font-medium">Cash on Delivery</span>
                      <span className="ml-auto text-xs text-[var(--ink-soft)]">Pay at your door</span>
                    </label>
                  )}

                  {!codEnabled && (
                    <p className="text-xs text-[var(--ink-soft)]">Cash on Delivery is currently unavailable.</p>
                  )}

                  {gateways.length === 0 && !codAvailable && (
                    <p className="text-xs text-[var(--coral-500)]">
                      No payment method is available right now. Please contact support.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Order summary */}
        <div className="h-fit self-start lg:sticky lg:top-24 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
          <p className="mb-4 font-semibold text-[var(--ink)]">Order Summary ({cartItems.length} items)</p>
          <div className="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {cartItems.map((item) => (
              <div key={item.cart_id} className="flex items-center gap-3 text-sm">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--blue-50)]">
                  <Image src={mediaUrl(item.image_1)} alt={item.product_name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <p className="line-clamp-1 font-medium text-[var(--ink)]">{item.product_name}</p>
                  <p className="text-xs text-[var(--ink-soft)]">Qty {item.product_quantity}</p>
                </div>
                <p className="font-mono-nums font-semibold">{formatINR(item.line_total)}</p>
              </div>
            ))}
          </div>
          {isLoggedIn && (
            <div className="mb-4 border-t border-[var(--line)] pt-4">
              <div className="flex gap-2">
                <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-[var(--line)] px-4">
                  <Tag size={15} className="text-[var(--ink-soft)]" />
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    disabled={!!appliedCoupon}
                    className="w-full bg-transparent text-sm outline-none disabled:opacity-70"
                  />
                </div>
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="flex items-center gap-1 rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink-soft)]"
                  >
                    <X size={14} /> Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={applyingCoupon}
                    className="rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {applyingCoupon ? "Checking…" : "Apply"}
                  </button>
                )}
              </div>
              {couponMsg && (
                <p className={`mt-2 text-xs font-medium ${couponError ? "text-[var(--coral-500)]" : "text-[var(--mint-600)]"}`}>
                  {couponMsg}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]"><span>Subtotal</span><span>{formatINR(summary?.subtotal ?? 0)}</span></div>
            <div className="flex justify-between text-[var(--ink-soft)]"><span>GST</span><span>{formatINR(summary?.gst ?? 0)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-[var(--mint-600)]">
                <span>Coupon ({appliedCoupon})</span><span>- {formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]"><span>Total</span><span>{formatINR(Math.max((summary?.total ?? 0) - discount, 0))}</span></div>
            {!isLoggedIn && <p className="pt-1 text-xs text-[var(--ink-soft)]">Estimated — final GST/shipping after mobile verification.</p>}
          </div>
          {isLoggedIn ? (
            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={placing}
              onClick={placeOrder}
              icon={placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            >
              {placing ? "Placing order…" : "Place Order"}
            </Button>
          ) : (
            <p className="mt-6 text-center text-xs text-[var(--ink-soft)]">
              Please verify your number above to place the order.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}