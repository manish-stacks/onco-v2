/**
 * Purane CodeIgniter DB (cp_*) se naye schema me data copy karta hai.
 *
 *   node src/migrations/import-legacy.js            // sab kuch
 *   node src/migrations/import-legacy.js --only=products,categories
 *   node src/migrations/import-legacy.js --dry-run   // sirf count dikhayega, kuch likhega nahi
 *   node src/migrations/import-legacy.js --reset     // pehle naye DB ka test data saaf karo, phir migrate karo
 *   node src/migrations/import-legacy.js --reset --dry-run  // sirf dekho kya-kya clear/migrate hota
 *
 * .env me ye chahiye (naye DB_* wale already hain, ye purane DB ke liye extra):
 *   LEGACY_DB_HOST, LEGACY_DB_PORT, LEGACY_DB_USER, LEGACY_DB_PASSWORD, LEGACY_DB_NAME
 *
 * Design:
 *  - RE-RUNNABLE hai. Dobara chalane se duplicate nahi banenge (INSERT IGNORE /
 *    already-migrated check), to agar beech me error aaye to bas dubara chala do.
 *  - Har row ka order fixed hai kyunki foreign keys hain:
 *      categories -> products -> product_categories -> customers -> addresses
 *      -> prescriptions (web+app unified) -> prescription_medicines
 *      -> orders (web+app unified) -> order_items (web+app unified)
 *  - Images ko IS SCRIPT me nahi chua gaya — jaisa filename purane DB me tha
 *    waisa hi naye DB me chala jaata hai. Uske baad admin panel se
 *    "Media Migration" (media-migration.service.js) chalao, wo khud
 *    oncohealthmart.com se image download karke S3 pe daal dega.
 *  - prescriptions/orders ke IDs purane se alag ho sakte hain (web+app dono
 *    ek hi naye table me unify ho rahe hain), isliye legacy_id/legacy_table
 *    column se track hota hai aur ek in-memory map se references fix hote hain.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1]?.split(',');

function shouldRun(step) {
  return !ONLY || ONLY.includes(step);
}

async function main() {
  const legacy = await mysql.createPool({
    host: process.env.LEGACY_DB_HOST,
    port: process.env.LEGACY_DB_PORT || 3306,
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
    decimalNumbers: true,
    timezone: 'Z',
  });

  const db = require('../config/db'); // naya DB — pehle se configured pool

  console.log(`[migrate] ${DRY_RUN ? 'DRY RUN — kuch likhega nahi' : 'LIVE — data likha jayega'}`);

  try {
    await legacy.query('SELECT 1');
    console.log('[migrate] legacy DB se connect ho gaya');
  } catch (err) {
    console.error('[migrate] legacy DB se connect NAHI ho paya:', err.message);
    console.error('[migrate] .env me LEGACY_DB_HOST/PORT/USER/PASSWORD/NAME check karo');
    process.exit(1);
  }

  const stats = {};

  // ---------------------------------------------------------------------
  // --reset : naye DB me abhi jo test/dummy data hai use saaf karo, taaki
  // ID collisions (INSERT IGNORE purana data skip kar de) na ho.
  // order_items/order_status_logs orders ke saath, prescription_medicines
  // prescriptions ke saath CASCADE se apne aap delete ho jaate hain.
  // ---------------------------------------------------------------------
  if (RESET) {
    const tables = ['orders', 'prescriptions', 'product_categories', 'addresses',
      'customers', 'products', 'categories'];
    console.log(`[migrate] --reset: clearing ${tables.join(', ')}`);
    if (!DRY_RUN) {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of tables) {
        await db.query(`TRUNCATE TABLE \`${t}\``);
        console.log(`[migrate]   truncated ${t}`);
      }
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } else {
      console.log('[migrate]   (dry-run — kuch delete nahi hua)');
    }
  }

  const run = async (label, fn) => {
    if (!shouldRun(label)) return;
    process.stdout.write(`[migrate] ${label}... `);
    const n = await fn();
    stats[label] = n;
    console.log(`${n} rows`);
  };

  // -------------------------------------------------------------------
  // 1. Categories — 1:1 column mapping, naye columns ko default milta hai
  // -------------------------------------------------------------------
  await run('categories', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_category');
    let n = 0;
    for (const r of rows) {
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO categories
          (category_id, category_name, slug, parent_id, meta_title, meta_keyword,
           meta_description, category_banner, category_image, footer_description,
           status, position, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
        [r.category_id, r.category_name, r.slug, r.parent_id || 0, r.meta_title,
          r.meta_keyword, r.meta_description, r.category_banner, r.category_image,
          r.footer_description, r.status, r.created_at, r.updated_at]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 2. Products
  // -------------------------------------------------------------------
  await run('products', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_product');
    let n = 0;
    for (const r of rows) {
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO products
          (product_id, product_name, short_description, long_description, sku, hsn_code,
           company_name, about_product, key_features, benifits, other_information,
           how_to_use, specification, caution, side_effects, slug, meta_title,
           meta_description, image_1, image_2, image_3, image_4, image_5, alt_text_1,
           category, product_mrp, product_sp, product_gst, weight_quantity, stock,
           discount_type, discount_amount, salt, presciption_required, deal_of_the_day,
           top_selling, latest_product, storage, isCOD, adding_date, status,
           created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [r.product_id, r.product_name, r.short_description, r.long_description, r.sku,
          r.hsn_code, r.company_name, r.about_product, r.key_features, r.benifits,
          r.other_information, r.how_to_use, r.specification, r.caution, r.side_effects,
          r.slug, r.meta_title, r.meta_description, r.image_1, r.image_2, r.image_3,
          r.image_4, r.image_5, r.alt_text_1, r.category, r.product_mrp, r.product_sp,
          r.product_gst, r.weight_quantity, r.stock, r.discount_type, r.discount_amount,
          r.salt, r.presciption_required, r.deal_of_the_day, r.top_selling,
          r.latest_product, r.storage, r.isCOD, r.adding_date, r.status,
          r.created_at, r.updated_at]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 3. product_categories (join table)
  // -------------------------------------------------------------------
  await run('product_categories', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_product_category');
    let n = 0;
    for (const r of rows) {
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?,?)`,
        [r.product_id, r.category_id]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 4. Customers
  // -------------------------------------------------------------------
  await run('customers', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_customer');
    let n = 0;
    for (const r of rows) {
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO customers
          (customer_id, platform, customer_name, password, email_id, mobile, address,
           city, state, country, pincode, registration_date, flag, status,
           is_mobile_verified, whatsapp_optin, new_mobile, otp, otp_expires,
           created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?,?,?)`,
        [r.customer_id, r.platform, r.customer_name, r.password, r.email_id, r.mobile,
          r.address, r.city, r.state, r.country, r.pincode, r.registration_date,
          r.flag, r.status, r.new_mobile, r.otp, r.otp_expires,
          r.created_at, r.updated_at]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 5. Addresses
  // -------------------------------------------------------------------
  await run('addresses', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_addresses');
    let n = 0;
    for (const r of rows) {
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO addresses
          (ad_id, user_id, city, state, pincode, house_no, type, stree_address,
           is_default, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,0,?,?)`,
        [r.ad_id, r.user_id, r.city, r.state, r.pincode, r.house_no, r.type,
          r.stree_address, r.createdAt, r.updatedAt]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 6. Prescriptions — web (cp_prescription) + app (cp_app_prescription) unify
  //    IDs auto-generate hote hain; legacy_id/legacy_table se purana reference
  //    yaad rakha jaata hai taaki orders.prescription_id fix ho sake (step 8)
  // -------------------------------------------------------------------
  const prescriptionMap = { web: new Map(), app: new Map() }; // old_id -> new_id

  await run('prescriptions_web', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_prescription');
    let n = 0;
    for (const r of rows) {
      const images = r.prescription_file ? JSON.stringify([r.prescription_file]) : null;
      if (DRY_RUN) { n++; continue; }

      const [existing] = await db.query(
        `SELECT prescription_id FROM prescriptions WHERE legacy_table='cp_prescription' AND legacy_id=?`,
        [r.prescription_id]
      );
      if (existing.length) {
        prescriptionMap.web.set(r.prescription_id, existing[0].prescription_id);
        continue;
      }

      const [res] = await db.query(
        `INSERT INTO prescriptions
          (customer_id, title, images, status, source, direct_upload,
           legacy_id, legacy_table, created_at, updated_at)
         VALUES (?,?,?,?, 'web', 0, ?, 'cp_prescription', ?, ?)`,
        [r.customer_id, r.prescription_name,
          images, r.status === 'Completed' ? 'Completed' : 'Pending',
          r.prescription_id, r.created_at, r.updated_at]
      );
      prescriptionMap.web.set(r.prescription_id, res.insertId);
      n++;
    }
    return n;
  });

  await run('prescriptions_app', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_app_prescription');
    let n = 0;
    for (const r of rows) {
      const images = [r.image_1, r.image_2, r.image_3, r.image_4, r.image_5].filter(Boolean);
      if (DRY_RUN) { n++; continue; }

      const [existing] = await db.query(
        `SELECT prescription_id FROM prescriptions WHERE legacy_table='cp_app_prescription' AND legacy_id=?`,
        [r.id]
      );
      if (existing.length) {
        prescriptionMap.app.set(r.id, existing[0].prescription_id);
        continue;
      }

      const [res] = await db.query(
        `INSERT INTO prescriptions
          (customer_id, images, status, source, direct_upload,
           legacy_id, legacy_table, created_at, updated_at)
         VALUES (?,?,?, 'app', ?, ?, 'cp_app_prescription', ?, ?)`,
        [r.user_id || null, images.length ? JSON.stringify(images) : null,
          /completed/i.test(r.prescription_status || '') ? 'Completed' : 'Pending',
          r.direct_upload ? 1 : 0, r.id, r.created_at, r.updated_at]
      );
      prescriptionMap.app.set(r.id, res.insertId);
      n++;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 7. prescription_medicines — sirf web prescriptions se (cp_prescription_medicine
  //    me apna primary key nahi hai, prescription_id se hi link hota hai)
  // -------------------------------------------------------------------
  await run('prescription_medicines', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_prescription_medicine');
    let n = 0;
    for (const r of rows) {
      const newPrescriptionId = prescriptionMap.web.get(r.prescription_id);
      if (!newPrescriptionId) continue; // orphan — parent prescription migrate nahi hui
      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT INTO prescription_medicines
          (prescription_id, medicine_name, medicine_link, created_at, updated_at)
         VALUES (?,?,?,?,?)`,
        [newPrescriptionId, r.medicine_name, r.medicine_link, r.created_at, r.updated_at]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 8. Orders — cp_order me web+app dono already ek table me hain
  //    (orderFrom column se pata chalta hai), IDs preserve karte hain
  // -------------------------------------------------------------------
  await run('orders', async () => {
    const [rows] = await legacy.query('SELECT * FROM cp_order');
    let n = 0;
    for (const r of rows) {
      const isApp = /app/i.test(r.orderFrom || 'web');
      const newPrescriptionId = r.prescription_id
        ? (isApp ? prescriptionMap.app.get(r.prescription_id) : prescriptionMap.web.get(r.prescription_id))
        : null;

      if (DRY_RUN) { n++; continue; }
      const [res] = await db.query(
        `INSERT IGNORE INTO orders
          (order_id, databaseOrderID, razorpayOrderID, order_date, prescription_id,
           transaction_number, customer_id, customer_name, patient_name, doctor_name,
           hospital_name, customer_email, customer_phone, customer_address,
           customer_country, customer_city, customer_state, customer_pincode, amount,
           subtotal, order_gst, coupon_code, coupon_discount, shipping_charge,
           additional_charge, comment, gst_invoice, payment_mode, cancellation_note,
           customer_shipping_name, customer_shipping_phone, customer_shipping_address,
           customer_shipping_country, customer_shipping_city, customer_shipping_state,
           customer_shipping_pincode, tracking_details, status, payment_option,
           prescription_notes, payment_status, orderFrom, awb_number, courier_name,
           tracking_status, tracking_location, tracking_datetime, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
                 ?,?,?,?,?,?,?, NOW(), NOW())`,
        [r.order_id, r.databaseOrderID, r.razorpayOrderID, r.order_date, newPrescriptionId,
          r.transaction_number, r.customer_id, r.customer_name, r.patient_name,
          r.doctor_name, r.hospital_name, r.customer_email, r.customer_phone,
          r.customer_address, r.customer_country, r.customer_city, r.customer_state,
          r.customer_pincode, r.amount, r.subtotal, r.order_gst, r.coupon_code,
          r.coupon_discount, r.shipping_charge, r.additional_charge, r.comment,
          r.gst_invoice, r.payment_mode, r.cancellation_note, r.customer_shipping_name,
          r.customer_shipping_phone, r.customer_shipping_address,
          r.customer_shipping_country, r.customer_shipping_city,
          r.customer_shipping_state, r.customer_shipping_pincode, r.tracking_details,
          r.status, r.payment_option, r.prescription_notes,
          /paid/i.test(r.payment_status || '') ? 'Paid' : 'Unpaid',
          isApp ? 'app' : 'web', r.awb_number, r.courier_name, r.tracking_status,
          r.tracking_location, r.tracking_datetime]
      );
      n += res.affectedRows;
    }
    return n;
  });

  // -------------------------------------------------------------------
  // 9. order_items — web (cp_order_details) + app (cp_app_order_details) unify
  //    legacy_details_id column exactly isi audit trail ke liye bana hai
  // -------------------------------------------------------------------
  let validOrderIds = null; // lazy-load ek baar, dono (web+app) calls me reuse hoga
  const migrateOrderDetails = async (table) => {
    if (!validOrderIds) {
      const [ids] = await db.query('SELECT order_id FROM orders');
      validOrderIds = new Set(ids.map((r) => r.order_id));
    }
    const [rows] = await legacy.query(`SELECT * FROM ${table}`);
    let n = 0;
    let orphaned = 0;
    for (const r of rows) {
      if (!validOrderIds.has(r.order_id)) { orphaned += 1; continue; } // purana corrupt/orphan row — koi matching order hi nahi
      if (DRY_RUN) { n++; continue; }
      const [existing] = await db.query(
        `SELECT item_id FROM order_items WHERE legacy_details_id=?`, [r.details_id]
      );
      if (existing.length) continue;

      const [res] = await db.query(
        `INSERT INTO order_items
          (order_id, product_id, product_name, product_image, unit_price, unit_mrp,
           unit_quantity, line_subtotal, tax_percent, tax_amount, line_total,
           legacy_details_id, created_at, updated_at)
         VALUES (?,?,?,?,?,0,?,?,?,?,?,?,?,?)`,
        [r.order_id, r.product_id, r.product_name, r.product_image, r.unit_price,
          r.unit_quantity, r.unit_price * r.unit_quantity, r.tax_percent, r.tax_amount,
          (r.unit_price * r.unit_quantity) + Number(r.tax_amount || 0),
          r.details_id, r.created_at, r.updated_at]
      );
      n += res.affectedRows;
    }
    if (orphaned) console.log(`\n[migrate]   ${table}: ${orphaned} orphan rows skip ki (koi matching order nahi mila)`);
    return n;
  };
  await run('order_items_web', () => migrateOrderDetails('cp_order_details'));
  await run('order_items_app', () => migrateOrderDetails('cp_app_order_details'));

  // -------------------------------------------------------------------
  console.log('\n[migrate] Summary:', stats);

  // AUTO_INCREMENT counters ko sabse bade migrated ID ke aage set karo,
  // warna agla naya insert purani ID se takra sakta hai
  if (!DRY_RUN) {
    for (const [table, pk] of [['products', 'product_id'], ['categories', 'category_id'],
      ['customers', 'customer_id'], ['addresses', 'ad_id'], ['orders', 'order_id']]) {
      const [[{ m }]] = await db.query(`SELECT COALESCE(MAX(${pk}),0)+1 AS m FROM ${table}`);
      await db.query(`ALTER TABLE ${table} AUTO_INCREMENT = ?`, [m]).catch((e) => {
        console.warn(`[migrate] AUTO_INCREMENT fix skipped for ${table}:`, e.message);
      });
    }
  }

  await legacy.end();
  console.log('[migrate] done. Ab admin panel se Media Migration (Scan + Run) chalao S3 images ke liye.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});