/**
 * COD eligibility — cart, quote and checkout all use this
 * so that all three places produce the same result.
 */

/**
 * Whether a single product is COD-eligible.
 *
 * Two things are checked:
 *   1. `isCOD` flag — DB se number (0/1) ya string ('0'/'1') dono aa sakta
 *      depending on the driver/config. `!it.isCOD` was a bug in the old code:
 *      the string '0' is truthy, so `!('0')` === false — meaning the flag
 *      COD stayed allowed even when the flag was 0. Hence the exact string match
 *      is used.
 *   2. `storage` text — if a cold-chain range (2-8°C, "refrigerate" etc.)
 *      is mentioned, we do not allow COD even if isCOD is true. A returned
 *      cold-chain medicine that warms up during delivery
 *      item cannot be resold — so such items are prepaid only.
 *
 * An order is COD-eligible only when ALL of its items are eligible —
 * if even one item is non-eligible the whole order requires online payment
 * (an order cannot be split into half COD and half online).
 */
function isProductCodEligible(product) {
  // Cold-chain items are prepaid-only, always.
  if (requiresColdChain(product?.storage)) return false;

  // Opt-OUT model: COD is allowed unless the product is EXPLICITLY marked non-COD
  // (isCOD === 0 / '0'). Legacy rows where isCOD is NULL/'' are treated as allowed,
  // so the admin's global "Cash on delivery allowed" switch actually takes effect
  // instead of being silently blocked by an unset per-product flag.
  const flag = product?.isCOD;
  if (flag === 0 || flag === '0') return false;
  return true;
}

/**
 * Looks for a pharma cold-chain range in the storage instructions.
 * "2-8°C" / "2°C to 8°C" / "store between 2 and 8 degrees" ye standard
 * is a refrigeration range (vaccines, biologics, insulin, etc.). A broad
 * a temperature regex is deliberately not used — otherwise "store below 25°C"
 * a normal room-temperature instruction would be mistaken for cold-chain
 * and COD would be wrongly blocked on genuine room-temperature products.
 */
function requiresColdChain(storage) {
  if (!storage) return false;
  const s = String(storage);
  if (/refrigerat|cold\s*chain|do not freeze/i.test(s)) return true;
  return /\b2\s*°?\s*(?:c\b|degrees?|deg)?\s*(?:-|–|to|and)\s*8\s*°?\s*(?:c\b|degrees?|deg)?/i.test(s);
}

module.exports = { isProductCodEligible, requiresColdChain };