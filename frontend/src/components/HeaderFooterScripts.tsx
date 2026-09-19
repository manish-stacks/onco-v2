"use client";

import { useEffect } from "react";

/**
 * Admin Settings me jo header/footer script paste kiya jaata hai (GTM,
 * analytics, Meta Pixel) use yahan inject karta hai. React ka
 * dangerouslySetInnerHTML <script> tags ko chalata nahi hai (browser
 * security), isliye ye seedha DOM me insert karta hai — wahi tareeka jo
 * asli Google Tag Manager snippet khud use karta hai.
 */
export function HeaderFooterScripts({
  headerCode,
  footerCode,
}: {
  headerCode?: string | null;
  footerCode?: string | null;
}) {
  useEffect(() => {
    const inserted: ChildNode[] = [];

    function inject(html: string, target: HTMLElement, position: InsertPosition) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      const nodes = Array.from(wrapper.childNodes);
      for (const node of nodes) {
        if (node.nodeName === "SCRIPT") {
          // innerHTML se bana <script> browser chalata nahi — naya banao
          const old = node as HTMLScriptElement;
          const fresh = document.createElement("script");
          Array.from(old.attributes).forEach((a) => fresh.setAttribute(a.name, a.value));
          fresh.text = old.text;
          target.insertAdjacentElement(position, fresh);
          inserted.push(fresh);
        } else {
          target.insertAdjacentElement(position, node.cloneNode(true) as HTMLElement);
          inserted.push(node);
        }
      }
    }

    if (headerCode?.trim()) inject(headerCode, document.head, "beforeend");
    if (footerCode?.trim()) inject(footerCode, document.body, "beforeend");

    return () => {
      inserted.forEach((n) => n.parentNode?.removeChild(n));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerCode, footerCode]);

  return null;
}
