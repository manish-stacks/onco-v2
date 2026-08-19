/**
 * COD eligibility — cart, quote, aur checkout teeno jagah se yahi use hota
 * hai, taaki teeno jagah same result aaye.
 */

/**
 * Ek product COD-eligible hai ya nahi.
 *
 * Do cheezein check hoti hain:
 *   1. `isCOD` flag — DB se number (0/1) ya string ('0'/'1') dono aa sakta
 *      hai, driver/config ke hisaab se. `!it.isCOD` purana code me bug tha:
 *      string '0' truthy hoti hai, isliye `!('0')` === false — matlab flag
 *      0 hone par bhi COD allowed reh jaata. Isliye exact string match
 *      karte hain.
 *   2. `storage` text — agar cold-chain range (2-8°C, "refrigerate" waghera)
 *      mention ho, to isCOD true hone ke bawजूद bhi COD nahi dete. Return
 *      hui cold-chain medicine agar delivery ke beech garam ho jaaye to
 *      wapas becha nahi ja sakta — isliye aise items sirf prepaid.
 *
 * Poora order tabhi COD-eligible hai jab USKE SAARE items eligible hon —
 * ek bhi non-eligible item ho to poora order online payment maangta hai
 * (order split karke aadha COD aadha online nahi ho sakta).
 */
function isProductCodEligible(product) {
  const codFlag = String(product?.isCOD ?? '0') === '1';
  if (!codFlag) return false;
  return !requiresColdChain(product?.storage);
}

/**
 * Storage instructions me pharma cold-chain range dhoondhta hai.
 * "2-8°C" / "2°C to 8°C" / "store between 2 and 8 degrees" ye standard
 * refrigeration range hai (vaccines, biologics, insulin waghera). Broad
 * temperature regex jaan-boojh ke nahi use kiya — warna "store below 25°C"
 * jaisi normal room-temperature instruction bhi galti se cold-chain ban
 * jaati, aur genuine room-temp products pe COD galat block ho jaata.
 */
function requiresColdChain(storage) {
  if (!storage) return false;
  const s = String(storage);
  if (/refrigerat|cold\s*chain|do not freeze/i.test(s)) return true;
  return /\b2\s*°?\s*(?:c\b|degrees?|deg)?\s*(?:-|–|to|and)\s*8\s*°?\s*(?:c\b|degrees?|deg)?/i.test(s);
}

module.exports = { isProductCodEligible, requiresColdChain };