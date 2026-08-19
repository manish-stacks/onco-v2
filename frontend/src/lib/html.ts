/**
 * CMS rich-text editor se aata hai — kabhi Word/Google Docs se paste kiya
 * hua content hota hai jisme har paragraph pe inline `style="color:...;
 * font-family:..."` chipka hota hai. Wo hamare design se clash karta hai
 * (rangeen text, ajeeb fonts). Sirf structure (p/br/strong/ul/li) rakhte
 * hain, presentation attributes hata dete hain — content wahi rehta hai,
 * bas hamari typography apply hoti hai.
 */
export function stripInlineFormatting(html: string): string {
  return html
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<o:p>\s*<\/o:p>/gi, "")
    .trim();
}

/** Plain text length nikaalo — HTML tags hata ke, "Read more" dikhana hai ya nahi decide karne ke liye */
export function htmlTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, "").trim().length;
}