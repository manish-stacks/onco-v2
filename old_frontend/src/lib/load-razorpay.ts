let razorpayLoadPromise: Promise<boolean> | null = null;

/** Razorpay checkout.js ek hi baar load karo, baaki calls me cached promise use ho */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);

  if (!razorpayLoadPromise) {
    razorpayLoadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayLoadPromise;
}