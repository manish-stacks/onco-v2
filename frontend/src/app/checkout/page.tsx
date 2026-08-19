"use client"
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, Plus, CreditCard, Wallet, Truck, FileWarning, ArrowRight, Loader2, CheckCircle2, Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineOtpVerify } from "@/components/auth/InlineOtpVerify";
import {
  addressApi, orderApi, prescriptionApi, authApi, mediaUrl, ApiError,
  type Address, type CheckoutPayload, type CheckoutResult, type PaymentGatewayOption,
} from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { submitToPayu } from "@/lib/payu";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/context/auth-context";
import type { Prescription } from "@/types";

const EMPTY_ADDRESS: Address = {
  full_name: "", phone: "", house_no: "", stree_address: "", landmark: "", city: "", state: "", pincode: "", type: "Home",
};

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isLoggedIn, user, refresh } = useAuth();

  // prescription-upload page se wapas aane par isi query param me naya
  // prescription_id milta hai — usko auto-select karna hai.
  const prescriptionIdFromUrl = params.get("prescription_id");
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
  const [gateways, setGateways] = useState<PaymentGatewayOption[]>([]);
  const [gateway, setGateway] = useState<"razorpay" | "payu">("razorpay");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kaunse payment gateways abhi configure hain — hardcode nahi karte,
  // backend se poochh ke sirf wahi dikhate hain jo actually chal sakte hain.
  useEffect(() => {
    orderApi
      .gateways()
      .then((res) => {
        if (!res) return;
        setGateways(res.available || []);
        if (res.default) setGateway(res.default);
      })
      .catch(() => setGateways([{ id: "razorpay", label: "Razorpay", type: "sdk" }]));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    addressApi.list<Address[]>().then((data) => {
      setAddresses(data ?? []);
      const def = (data ?? []).find((a) => a.is_default) ?? data?.[0];
      if (def?.ad_id) setSelectedAddressId(def.ad_id);
    }).catch(() => setAddresses([]));

    if (summary?.requires_prescription) {
      // Status filter jaan-boojh ke nahi laga rahe — customer ki koi bhi
      // prescription select ho sakti hai (Pending bhi), pharmacist baad me
      // verify karega. URL me prescription_id ho (upload ke turant baad) to
      // uska data alag se fetch karke list me sabse upar rakhte hain, taaki
      // pagination/limit se bahar reh jaane par bhi miss na ho.
      Promise.all([
        prescriptionApi.list<Prescription[]>({ limit: 20 }).then((res) => res?.data ?? []).catch(() => []),
        prescriptionIdFromUrl
          ? prescriptionApi.detail<Prescription>(prescriptionIdFromUrl).catch(() => null)
          : Promise.resolve(null),
      ]).then(([list, fresh]) => {
        let merged = list;
        if (fresh && !list.some((p) => String(p.prescription_id) === String(fresh.prescription_id))) {
          merged = [fresh, ...list];
        }
        setPrescriptions(merged);

        if (prescriptionIdFromUrl && merged.some((p) => String(p.prescription_id) === String(prescriptionIdFromUrl))) {
          setSelectedPrescriptionId(prescriptionIdFromUrl);
        } else if (merged[0]?.prescription_id) {
          setSelectedPrescriptionId(merged[0].prescription_id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, summary?.requires_prescription, prescriptionIdFromUrl]);

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
      // Backend create sirf { ad_id } deta hai, poora address nahi — isliye
      // save karne ke baad list dobara fetch karte hain taaki asli saved
      // record (id ke saath) state me aaye, guessed object nahi.
      await addressApi.create<Address>(newAddress);
      const list = await addressApi.list<Address[]>();
      setAddresses(list ?? []);
      const match = (list ?? []).find(
        (a) => a.stree_address === newAddress.stree_address && a.pincode === newAddress.pincode
      );
      setSelectedAddressId(match?.ad_id ?? list?.[list.length - 1]?.ad_id ?? null);
      setShowAddressForm(false);
      setNewAddress(EMPTY_ADDRESS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save address");
    }
  }

  async function placeOrder() {
    if (!isLoggedIn) return;
    if (!selectedAddress) {
      setError("Please select or add a delivery address.");
      return;
    }
    if (summary?.requires_prescription && !selectedPrescriptionId) {
      setError("This order needs a verified prescription. Please upload or select one.");
      return;
    }
    setError(null);
    setPlacing(true);

    // OTP se account bana to naam kabhi nahi poochha jaata — jo bhi
    // pehla naam yahan (billing/patient) diya jaaye wahi account pe
    // permanently save kar dete hain. Sirf tab jab account me abhi tak
    // koi naam na ho — kisi existing naam ko override nahi karte. Order
    // ko block nahi karna, isliye background me fire-and-forget.
    if (!user?.customer_name?.trim() && selectedAddress.full_name) {
      authApi
        .updateProfile({ customer_name: selectedAddress.full_name })
        .then(() => refresh())
        .catch(() => { /* non-critical — order flow continue rahega */ });
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

      // COD, ya koi payment session hi nahi bana (edge case) — order seedha confirm
      if (paymentMode === "cod" || !payment) {
        await refreshCart();
        router.push(`/order-success/${order.order_id}`);
        return;
      }

      // Razorpay — SDK modal
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

      // PayU — hidden form POST, poora naya page load hoga
      if (payment.type === "redirect" && payment.gateway === "payu" && payment.payu) {
        submitToPayu(payment.payu);
        return;
      }

      // Anjaana payment shape — order to ban chuka hai, order page pe bhej do
      await refreshCart();
      router.push(`/order-success/${order.order_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place order. Please try again.");
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
        <div className="mb-6 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!isLoggedIn ? (
            <InlineOtpVerify onVerified={() => { /* isLoggedIn context se apne aap update hoga, cart merge hoga */ }} />
          ) : (
            <>
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
                      <Link href="/prescription-upload?redirect=/checkout" className="font-semibold text-[var(--blue-600)]">Upload one now</Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prescriptions.map((p) => (
                        <label key={p.prescription_id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 text-sm ${selectedPrescriptionId === p.prescription_id ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)]"}`}>
                          <input type="radio" checked={selectedPrescriptionId === p.prescription_id} onChange={() => setSelectedPrescriptionId(p.prescription_id)} />
                          {p.images?.[0] && <Image src={mediaUrl(p.images[0])} alt="prescription" width={40} height={40} className="rounded object-cover" />}
                          <span className="flex-1">{p.reference_code || `Prescription #${p.prescription_id}`}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            p.status === "Approved" || p.status === "Completed"
                              ? "bg-[var(--mint-50)] text-[var(--mint-600)]"
                              : p.status === "Rejected" || p.status === "Cancelled"
                                ? "bg-[#FFEDEA] text-[var(--coral-500)]"
                                : "bg-[#FFF4E0] text-[#8A5A0C]"
                          }`}>
                            {p.status}
                          </span>
                        </label>
                      ))}
                      {selectedPrescriptionId && prescriptions.find((p) => p.prescription_id === selectedPrescriptionId)?.status !== "Approved" && (
                        <p className="text-xs text-[var(--ink-soft)]">
                          Ye prescription abhi pharmacist verify kar raha hai — order place ho jaayega, status
                          &quot;Prescription Pending&quot; rahega jab tak approve na ho jaaye.
                        </p>
                      )}
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
                  {paymentMode === "online" && gateways.length > 1 && (
                    <div className="ml-8 flex gap-2 pt-1">
                      {gateways.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGateway(g.id)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize ${gateway === g.id ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}
                        >
                          {g.label || g.id}
                        </button>
                      ))}
                    </div>
                  )}
                  {paymentMode === "online" && gateways.length === 0 && (
                    <p className="ml-8 text-xs text-[var(--coral-500)]">Online payment abhi available nahi hai.</p>
                  )}
                </div>
              </div>
            </>
          )}
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
            {!isLoggedIn && <p className="pt-1 text-xs text-[var(--ink-soft)]">Estimated — final GST/shipping mobile verify karne ke baad.</p>}
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
</p>          )}
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