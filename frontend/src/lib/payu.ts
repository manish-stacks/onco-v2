import type { PayuSession } from "@/lib/api";

/**
 * PayU does not work from React — we build a signed hidden form and send the browser
 * We have to POST to the PayU endpoint. The backend returns `endpoint` + `params`
 * (hash included). PayU redirects the customer back to `/payment/success` or
 * redirects to `/payment/failed` (after backend verification), so this
 * return nothing after the call — the page will navigate away.
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
