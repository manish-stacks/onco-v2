/**
 * Comes from the CMS rich-text editor — sometimes pasted from Word/Google Docs
 * content where every paragraph carries an inline `style="color:...;
 * font-family:..."` is attached. That clashes with our design
 * (coloured text, odd fonts). Only the structure (p/br/strong/ul/li) is kept
 * and strip presentation attributes — the content stays the same,
 * only our typography is applied.
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

/** Get the plain-text length — strips HTML tags, used to decide whether to show "Read more" */
export function htmlTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, "").trim().length;
}