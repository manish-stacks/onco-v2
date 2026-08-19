import type { PayuSession } from "@/lib/api";

/**
 * PayU React se nahi chalta — signed hidden form banake browser ko seedha
 * PayU ke endpoint pe POST karna padta hai. Backend `endpoint` + `params`
 * (hash included) deta hai. PayU customer ko wapas `/payment/success` ya
 * `/payment/failed` pe redirect karta hai (backend verify karke), isliye is
 * call ke baad kuch return nahi karna — page navigate ho jaayega.
 */
export function submitToPayu({ endpoint, params }: PayuSession): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = endpoint;
  form.style.display = "none";

  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value ?? "");
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
