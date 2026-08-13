"use client"
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, Plus, CreditCard, Wallet, Truck, FileWarning, ArrowRight, Loader2, CheckCircle2, Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addressApi, orderApi, prescriptionApi, mediaUrl, ApiError,
  type Address, type CheckoutPayload, type CheckoutResult,
} from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import type { Prescription } from "@/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const EMPTY_ADDRESS: Address = {
  full_name: "", phone: "", house_no: "", stree_address: "", landmark: "", city: "", state: "", pincode: "", type: "Home",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { cartItems, summary, refreshCart } = useStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Address>(EMPTY_ADDRESS);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | number | null>(null);

  // Patient / doctor details for prescription orders
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [comment, setComment] = useState("");

  // Shipping address (if different from billing)
  const [shippingSame, setShippingSame] = useState(true);
  const [shippingAddress, setShippingAddress] = useState<Address>(EMPTY_ADDRESS);

  const [paymentMode, setPaymentMode] = useState<"cod" | "online">("cod");
  const [gateway, setGateway] = useState<"razorpay" | "payu">("razorpay");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    addressApi.list<Address[]>().then((data) => {
      setAddresses(data ?? []);
      const def = (data ?? []).find((a) => a.is_default) ?? data?.[0];
      if (def?.ad_id) setSelectedAddressId(def.ad_id);
    }).catch(() => setAddresses([]));

    if (summary?.requires_prescription) {
      prescriptionApi.list<Prescription[]>({ status: "approved", limit: 20 }).then((res) => {
        const list = res?.data ?? [];
        setPrescriptions(list);
        if (list[0]?.prescription_id) setSelectedPrescriptionId(list[0].prescription_id);
      }).catch(() => setPrescriptions([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, summary?.requires_prescription]);

  useEffect(() => {
    if (!summary?.cod_allowed) setPaymentMode("online");
  }, [summary?.cod_allowed]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.ad_id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  function addressLine(a: Address) {
    return [a.house_no, a.stree_address, a.landmark].filter(Boolean).join(", ");
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await addressApi.create<Address>(newAddress);
      if (created) {
        setAddresses((prev) => [...prev, created]);
        setSelectedAddressId(created.ad_id ?? null);
      }
      setShowAddressForm(false);
      setNewAddress(EMPTY_ADDRESS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save address");
    }
  }

  async function placeOrder() {
    if (!selectedAddress) {
      setError("Please select or add a delivery address.");
      return;
    }
    // if (summary?.requires_prescription && !selectedPrescriptionId) {
    //   setError("This order needs a verified prescription. Please upload or select one.");
    //   return;
    // }
    setError(null);
    setPlacing(true);
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

      if (paymentMode === "cod" || !payment) {
        await refreshCart();
        router.push(`/order-success/${order.order_id}`);
        return;
      }

      if (payment.type === "sdk" && payment.gateway === "razorpay") {
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) throw new ApiError("Could not load payment gateway. Please try again.", 0);
        const rzp = new window.Razorpay({
          key: "rzp_test_T8XbqaXF6Hu9ea" || payment.key,
          amount: payment.amount,
          currency: payment.currency || "INR",
          order_id: payment.gateway_order_id,
          name: "Onco Health Mart",
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await orderApi.verifyPayment(response);
              await refreshCart();
              router.push(`/payment/success?order_id=${order.order_id}`);
            } catch {
              router.push(`/payment/failed?order_id=${order.order_id}`);
            }
          },
          modal: { ondismiss: () => router.push(`/payment/failed?order_id=${order.order_id}`) },
        });
        rzp.open();
        return;
      }

      if (payment.type === "redirect" && payment.action_url) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = payment.action_url;
        Object.entries(payment.fields ?? {}).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = v;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      await refreshCart();
      router.push(`/order-success/${order.order_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Login to checkout</h1>
        <Button href="/login?redirect=/checkout" icon={<ArrowRight size={16} />}>Login</Button>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Your cart is empty</h1>
        <Button href="/search">Browse Medicines</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 font-display text-3xl font-bold text-[var(--ink)]">Checkout</h1>

      {error && (
        <div className="mb-6 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Address */}
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
            <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
              <MapPin size={17} className="text-[var(--blue-500)]" /> Delivery Address
            </p>
            <div className="space-y-3">
              {addresses.map((a) => (
                <label
                  key={a.ad_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-4 text-sm transition ${
                    selectedAddressId === a.ad_id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={selectedAddressId === a.ad_id}
                    onChange={() => setSelectedAddressId(a.ad_id ?? null)}
                  />
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      {a.full_name} · {a.phone} {a.type && <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase">{a.type}</span>}
                    </p>
                    <p className="text-[var(--ink-soft)]">{addressLine(a)}, {a.city}, {a.state} - {a.pincode}</p>
                  </div>
                </label>
              ))}
            </div>

            {!showAddressForm ? (
              <button onClick={() => setShowAddressForm(true)} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[var(--blue-600)]">
                <Plus size={15} /> Add new address
              </button>
            ) : (
              <form onSubmit={handleAddAddress} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input required placeholder="Full name" value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input required placeholder="Mobile number" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="House / Flat no." value={newAddress.house_no} onChange={(e) => setNewAddress({ ...newAddress, house_no: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input required placeholder="Street address" value={newAddress.stree_address} onChange={(e) => setNewAddress({ ...newAddress, stree_address: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Landmark (optional)" value={newAddress.landmark} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none sm:col-span-2" />
                <input required placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input required placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input required placeholder="Pincode" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <select value={newAddress.type} onChange={(e) => setNewAddress({ ...newAddress, type: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none">
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="md">Save Address</Button>
                  <button type="button" onClick={() => setShowAddressForm(false)} className="text-sm font-medium text-[var(--ink-soft)]">Cancel</button>
                </div>
              </form>
            )}
          </div>

          {/* Shipping address toggle */}
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--ink)]">
              <input type="checkbox" checked={shippingSame} onChange={(e) => setShippingSame(e.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
              Shipping address same as billing
            </label>
            {!shippingSame && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input placeholder="Full name" value={shippingAddress.full_name} onChange={(e) => setShippingAddress({ ...shippingAddress, full_name: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Mobile number" value={shippingAddress.phone} onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Street address" value={shippingAddress.stree_address} onChange={(e) => setShippingAddress({ ...shippingAddress, stree_address: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none sm:col-span-2" />
                <input placeholder="City" value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="State" value={shippingAddress.state} onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Pincode" value={shippingAddress.pincode} onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
              </div>
            )}
          </div>

          {/* Prescription */}
          {summary?.requires_prescription && (
            <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
              <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                <FileWarning size={17} className="text-[#8A5A0C]" /> Prescription Required
              </p>
              {prescriptions.length === 0 ? (
                <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-soft)]">
                  No approved prescription on file.{" "}
                  <Link href="/prescription-upload" className="font-semibold text-[var(--blue-600)]">Upload one now</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {prescriptions.map((p) => (
                    <label key={p.prescription_id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 text-sm ${selectedPrescriptionId === p.prescription_id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}>
                      <input type="radio" checked={selectedPrescriptionId === p.prescription_id} onChange={() => setSelectedPrescriptionId(p.prescription_id)} />
                      {p.images?.[0] && <Image src={mediaUrl(p.images[0])} alt="prescription" width={40} height={40} className="rounded object-cover" />}
                      <span>{p.reference_code || `Prescription #${p.prescription_id}`}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input placeholder="Patient name" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Doctor name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none" />
                <input placeholder="Hospital / clinic name" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none sm:col-span-2" />
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
              {summary?.cod_allowed && (
                <label className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-4 text-sm ${paymentMode === "cod" ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}>
                  <input type="radio" checked={paymentMode === "cod"} onChange={() => setPaymentMode("cod")} />
                  <Truck size={16} className="text-[var(--ink-soft)]" />
                  <span className="font-medium">Cash on Delivery</span>
                </label>
              )}
              <label className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-4 text-sm ${paymentMode === "online" ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}>
                <input type="radio" checked={paymentMode === "online"} onChange={() => setPaymentMode("online")} />
                <Wallet size={16} className="text-[var(--ink-soft)]" />
                <span className="font-medium">Pay Online (UPI / Card / Netbanking)</span>
              </label>
              {paymentMode === "online" && (
                <div className="ml-8 flex gap-2 pt-1">
                  {(["razorpay", "payu"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGateway(g)}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${gateway === g ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="h-fit rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
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
          <div className="space-y-2 border-t border-[var(--line)] pt-4 text-sm font-mono-nums">
            <div className="flex justify-between text-[var(--ink-soft)]"><span>Subtotal</span><span>{formatINR(summary?.subtotal ?? 0)}</span></div>
            <div className="flex justify-between text-[var(--ink-soft)]"><span>GST</span><span>{formatINR(summary?.gst ?? 0)}</span></div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-[var(--ink)]"><span>Total</span><span>{formatINR(summary?.total ?? 0)}</span></div>
          </div>
          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={placing}
            onClick={placeOrder}
            icon={placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          >
            {placing ? "Placing order…" : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}