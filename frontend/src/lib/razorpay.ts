import type { RazorpaySession } from "@/lib/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let loadPromise: Promise<boolean> | null = null;

/** Script ek hi baar load hota hai, baaki calls cached promise use karte hain */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
  return loadPromise;
}

interface OpenOptions {
  session: RazorpaySession;
  name?: string;
  description?: string;
  onSuccess: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
}

/**
 * Razorpay modal kholo. `session` backend ke `payment.razorpay` (checkout
 * response) ya `retryPayment` ke `razorpay` field se aata hai — dono jagah
 * shape same hai: { key_id, order_id, amount, currency, prefill? }.
 */
export async function openRazorpayCheckout({ session, name, description, onSuccess, onDismiss }: OpenOptions) {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Payment gateway load nahi ho paya. Internet check karo.");
  }

  const rzp = new window.Razorpay({
    key: session.key_id,
    order_id: session.order_id,
    amount: session.amount,
    currency: session.currency || "INR",
    name: name || "Onco Health Mart",
    description,
    prefill: session.prefill,
    handler: onSuccess,
    modal: { ondismiss: onDismiss },
    theme: { color: "#2563eb" },
  });

  rzp.open();
}
