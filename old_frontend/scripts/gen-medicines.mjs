import fs from "fs";

const categories = JSON.parse(fs.readFileSync("src/data/categories.json"));
const brands = JSON.parse(fs.readFileSync("src/data/brands.json"));

const names = [
  ["Cardivas 3.125", "cat-3", "Controls high blood pressure and reduces heart strain."],
  ["Glucomet SR 500", "cat-2", "Helps regulate blood sugar in type-2 diabetes."],
  ["Shelcal 500", "cat-1", "Calcium and Vitamin D3 supplement for bone health."],
  ["Zincovit Tablets", "cat-9", "Multivitamin and mineral supplement for daily immunity."],
  ["Himalaya Liv.52 DS", "cat-1", "Ayurvedic liver support and detox formula."],
  ["Ensure Diabetes Care", "cat-2", "Balanced nutrition drink for diabetics."],
  ["Cetaphil Gentle Cleanser", "cat-6", "Soap-free daily face wash for sensitive skin."],
  ["Johnson's Baby Lotion", "cat-4", "Mild moisturising lotion for delicate baby skin."],
  ["Evion 400 Capsules", "cat-9", "Vitamin E capsules supporting skin and hair health."],
  ["Accu-Chek Active Glucometer", "cat-8", "Blood glucose monitoring device with 10 strips."],
  ["Dolo 650 Tablets", "cat-1", "Fever and mild-to-moderate pain relief."],
  ["Folvite 5mg", "cat-5", "Folic acid supplement recommended during pregnancy."],
  ["Omnacortil 10", "cat-1", "Steroid used to manage inflammation and allergies."],
  ["Digene Gel Mint", "cat-1", "Fast relief from acidity, gas and indigestion."],
  ["Revital H Capsules", "cat-9", "Daily energy and stamina multivitamin."],
  ["Moov Pain Relief Spray", "cat-1", "Fast-acting spray for muscular and joint pain."],
  ["Dettol Antiseptic Liquid", "cat-7", "Trusted antiseptic for cuts, wounds and hygiene."],
  ["Omron Digital BP Monitor", "cat-8", "Automatic upper-arm blood pressure monitor."],
  ["Mamaearth Stretch Oil", "cat-5", "Natural oil to reduce pregnancy stretch marks."],
  ["Sebamed Baby Wash", "cat-4", "pH 5.5 gentle cleanser for newborns."],
  ["Thermoscan Digital Thermometer", "cat-8", "Fast 10-second digital fever thermometer."],
  ["Betadine Ointment", "cat-7", "Antiseptic ointment for minor wounds and burns."],
  ["Neurobion Forte", "cat-9", "Vitamin B-complex for nerve health and energy."],
  ["Saridon Tablets", "cat-1", "Fast relief from headache and body pain."]
];

function rand(min, max) { return Math.round(min + Math.random() * (max - min)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

const reviewers = ["Aarav Sharma", "Priya Nair", "Rohan Mehta", "Sneha Iyer", "Karan Kapoor", "Ananya Gupta", "Vikram Singh", "Isha Verma"];
const comments = [
  "Genuine product, delivered well packed and on time.",
  "Works exactly as prescribed by my doctor. Will reorder.",
  "Good pricing compared to my local pharmacy.",
  "Packaging could be better but product quality is great.",
  "Fast delivery, easy to use website, highly recommend.",
  "Been using this for months now, consistent results."
];

const medicines = names.map(([name, categoryId, benefit], i) => {
  const brand = pick(brands);
  const mrp = rand(80, 950);
  const discountPercent = rand(5, 35);
  const price = Math.round(mrp * (1 - discountPercent / 100));
  const rxRequired = /Cardivas|Glucomet|Omnacortil|Folvite/.test(name);
  const reviewCount = rand(12, 480);
  const id = `med-${i + 1}`;
  const slug = slugify(name);
  return {
    id,
    slug,
    name,
    manufacturer: brand.name,
    brandId: brand.id,
    categoryId,
    image: `https://picsum.photos/seed/${slug}-1/600/600`,
    images: [1, 2, 3].map((n) => `https://picsum.photos/seed/${slug}-${n}/600/600`),
    mrp,
    price,
    discountPercent,
    rating: +(3.6 + Math.random() * 1.3).toFixed(1),
    reviewCount,
    prescriptionRequired: rxRequired,
    inStock: Math.random() > 0.08,
    packSize: pick(["Strip of 10 tablets", "Bottle of 60ml", "Pack of 30 capsules", "Box of 15 tablets", "1 unit"]),
    composition: `${name.split(" ")[0]} — refer to package insert for full composition.`,
    benefits: [benefit, "Manufactured under strict quality control standards.", "Trusted by pharmacists across India."],
    uses: [benefit, "As directed by your physician for related conditions."],
    dosage: "Take as directed by your physician. Do not self-medicate without consultation.",
    sideEffects: ["Mild nausea (rare)", "Dizziness in sensitive individuals", "Consult a doctor if symptoms persist"],
    storage: "Store in a cool, dry place away from direct sunlight. Keep out of reach of children.",
    tags: [categoryId, brand.slug],
    reviews: Array.from({ length: 3 }).map((_, r) => ({
      id: `${id}-rev-${r + 1}`,
      author: pick(reviewers),
      rating: rand(3, 5),
      date: `2026-0${rand(1, 7)}-${rand(10, 28)}`,
      comment: pick(comments),
      verified: Math.random() > 0.2
    })),
    faqs: [
      { question: `Is a prescription required for ${name}?`, answer: rxRequired ? "Yes, please upload a valid prescription during checkout." : "No, this is available as an over-the-counter product." },
      { question: "How soon will this be delivered?", answer: "Standard delivery takes 24–48 hours in most serviceable pincodes." }
    ]
  };
});

fs.writeFileSync("src/data/medicines.json", JSON.stringify(medicines, null, 2));
console.log(`Generated ${medicines.length} medicines`);
