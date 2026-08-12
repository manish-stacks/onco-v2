# oncohealthmart-backend

Poora Node.js/Express backend. **mysql2 (raw queries, koi ORM nahi)** + **Redis cache**.
Web aur App ke orders/prescriptions ab ek hi jagah manage hote hain.

---

## Kya-kya unify hua

### 1. Orders — ab sirf EK table

| Pehle | Ab |
|---|---|
| `cp_order` | `orders` |
| `cp_order_details` (web items) + `cp_app_order_details` (app items) | `order_items` — ek table |
| `cp_order_temp` + `cp_temp_order` + `cp_temp_order_details` | **HATA diye** |
| — | `order_status_logs` (naya — har status change ka audit trail) |

**Temp order ka concept khatam.** Unpaid online order bhi `orders` me hi rehta hai
(`payment_status = 'Unpaid'`, `status = 'Pending'`). Payment aane pe bas status update
hota hai — data kahin move nahi hota. Isse "temp me hai ya real me hai" wali confusion khatam.

### 2. Prescriptions — ek table, images JSON array me

| Pehle | Ab |
|---|---|
| `cp_prescription` (web, 1 file) + `cp_app_prescription` (app, `image_1`..`image_5`) | `prescriptions` — ek table |

`images` ab **JSON array** hai. 1 image bhejo ya 10 — sab fit ho jaati hain:
```json
{ "prescription_id": 42, "images": ["/uploads/prescriptions/a.jpg", "/uploads/prescriptions/b.jpg"] }
```
`image_1..image_5` wale fixed columns khatam. Baad me aur images add karni ho to
`POST /prescriptions/:id/images` hai, ek image hatani ho to `DELETE /prescriptions/:id/images`.

### 3. Saari tables ke clean naam

`cp_customer` → `customers`, `cp_product` → `products`, `cp_category` → `categories`,
`cp_admin_master` → `admins`, `cp_admin_usertype` → `roles`, `cp_admin_permission` → `role_permissions`,
`cp_shopping_cart` → `cart_items`, `cp_coupon` → `coupons`, `cp_content` → `pages`,
`cp_reviews` → `testimonials`, `cp_shop_by_brand` → `brands` … (poori list migration file me)

### 4. Nayi tables

`inventory_logs` (har stock movement), `order_status_logs`, `coupon_usages`,
`wishlists`, `product_reviews`, `prescription_medicines`, `admin_activity_logs`

---

## Setup

```bash
cd oncohealthmart-backend
npm install
cp .env.example .env      # DB + Redis + Razorpay + MSG91 creds bharo
```

### Step 1 — Backup lo (zaroori!)
```bash
mysqldump -u USER -p oncohealthmart > backup_$(date +%F).sql
```

### Step 2 (local only) — data trim

Production dump me 34,000+ orders hain. Local pe develop karne ke liye 50 kaafi hain,
aur migration ka `ALTER TABLE orders` poori table rebuild karta hai — 34k rows pe
minutes lagte hain, 50 rows pe milliseconds.

```bash
npm run trim -- --orders=50
npm run trim -- --orders=50 --prescriptions=50 --yes   # prescriptions bhi trim + no prompt
```

Kya karta hai: latest N orders rakh ke baaki delete, unke order items/logs/coupon
usages saaf, aur temp order tables khaali. Products, customers, categories sab
waise ke waise rehte hain.

Confirmation maangta hai (`--yes` se skip), aur `NODE_ENV=production` pe chalne se
mana kar deta hai. Migration se pehle ya baad, jab bhi chalao — dono schema pe kaam
karta hai.

**Production pe kabhi mat chalana.**

### Step 3 — Migration
```bash
npm run migrate
```

Runner har statement alag chalata hai aur live print karta hai:
```
[40/56] ALTER   orders                              ok    412ms
```

Resumable hai — beech me ruk jaye to dobara chalao, ho chuke steps `skip` ho jaayenge.
Bade ALTER ko clause-by-clause tod ke bhi chala leta hai, to aadha-applied ALTER bhi
complete ho jaata hai.

**Agar `LOCKED` aaye:** koi aur connection tables pakde baitha hai. Backend server band
karo, phpMyAdmin/Workbench tabs band karo. Kaun pakde hai dekhne ke liye:
```sql
SHOW FULL PROCESSLIST;
-- jis row ka State = "Waiting for table metadata lock" ho, uske upar wali
-- (zyada Time wali) query ki Id le ke:
KILL <id>;
```
Ye saara schema refactor karti hai aur row counts print karti hai.
**Purani tables khud drop nahi karti** — counts verify karke tum manually karo:
```sql
DROP TABLE cp_order_details, cp_app_order_details, cp_order_temp,
  cp_temp_order, cp_temp_order_details, cp_prescription,
  cp_app_prescription, cp_prescription_medicine;
```

### Step 4 — Integrations + media migration
```bash
npm run migrate:002
npm run migrate:003
```
otp_logs, device_tokens, notification_logs, shipments tables banti hain aur orders me `payment_gateway` column add hota hai.

### Step 5 — Roles + permissions + super admin seed
```bash
npm run seed
```
Default login: `superadmin` / `Admin@123` — **login karke turant password badlo.**

Ye 5 roles banti hain: Super Admin, Sub Admin, Order Manager, Inventory Manager, Employee.

### Step 6 — Server
```bash
npm run dev     # local
npm start       # production
```
Health check: `GET /api/health` (DB + Redis dono ka status batata hai)

---

## Web vs App — kaise handle hota hai

Dono **bilkul same endpoints** use karte hain. Client sirf ek header bhejta hai:

```
X-Client-Platform: web
X-Client-Platform: app
```

Isse `orders.orderFrom` aur `prescriptions.source` apne aap set ho jaata hai.
Checkout, order list, cancel, prescription upload — poora code path same hai.

Admin panel me filter karke dekh sakte ho:
```
GET /api/admin/orders?orderFrom=web    # sirf website ke
GET /api/admin/orders?orderFrom=app    # sirf app ke
GET /api/admin/orders                  # dono milke
```

---

## API map

Base: `/api`

### Customer APIs — `/api/app/*`

**Auth**
```
POST   /auth/register              POST /auth/login
POST   /auth/otp/request           POST /auth/otp/verify
POST   /auth/password/reset        POST /auth/password/change
GET    /auth/me                    PATCH /auth/me
```

**Catalog** (public)
```
GET /home                    # poora homepage ek call me (cached)
GET /search?q=
GET /products                # filters: category_id, search, min_price, max_price, top_selling, latest, deals
GET /products/:slug
GET /products/:productId/reviews
GET /categories              GET /categories/tree      GET /categories/:slug
GET /serviceable-city?city=
```

**Cart / Wishlist / Coupons**
```
GET /cart          GET /cart/count      POST /cart
PATCH /cart/:cartId    DELETE /cart/:cartId    DELETE /cart
POST /cart/merge                 # app ka offline cart server pe merge
POST /cart/apply-coupon
GET  /coupons                    # available offers
GET /wishlist      POST /wishlist (toggle)    DELETE /wishlist/:productId
```

**Addresses**
```
GET /addresses     POST /addresses
PATCH /addresses/:addressId        PATCH /addresses/:addressId/default
DELETE /addresses/:addressId
```

**Prescriptions** (multipart field name: `images`, max 10)
```
POST   /prescriptions
GET    /prescriptions              GET /prescriptions/:id
POST   /prescriptions/:id/images   DELETE /prescriptions/:id/images
DELETE /prescriptions/:id
```

**Orders**
```
POST /orders/quote           # order banaye bina totals dekho (cart page)
POST /orders/checkout
POST /orders/verify-payment
GET  /orders                 GET /orders/:orderId    GET /orders/:orderId/track
POST /orders/:orderId/retry-payment
POST /orders/:orderId/cancel
POST /orders/:orderId/review
POST /payments/razorpay/webhook   # Razorpay dashboard me ye URL daalo
```

**CMS**
```
GET /settings   GET /pages   GET /pages/:slug   GET /news   GET /news/:id
POST /contact   GET /locations/states|countries|cities
```

### Admin APIs — `/api/admin/*`

Har endpoint pe permission check lagta hai. Login response me `permissions` array
aata hai — frontend usi se menu render kare.

```
POST /auth/login    GET /auth/me    PATCH /auth/me    POST /auth/change-password

GET  /dashboard                    # cards + trends + top products + low stock, sab ek call me
GET  /dashboard/quick-stats        # halka, 30s poll ke liye

ORDERS
GET   /orders  /orders/stats  /orders/export  /orders/:id  /orders/:id/invoice
PATCH /orders/:id  /orders/:id/status  /orders/:id/tracking  /orders/:id/payment
POST  /orders/:id/cancel           # refund + stock wapasi + coupon wapasi automatic

PRODUCTS
GET /products  /products/export  /products/:id
POST /products    PUT /products/:id    DELETE /products/:id
PATCH /products/bulk-status   /products/:id/status

INVENTORY
GET  /inventory/summary  /low-stock  /out-of-stock  /expiring  /movements  /export
PATCH /inventory/:productId              # exact stock set karo (physical count ke baad)
POST  /inventory/:productId/add          # naya stock aaya
POST  /inventory/:productId/remove       # damage / expiry
POST  /inventory/bulk                    # CSV import / stock taking

CATEGORIES /categories …    BRANDS /brands …    COUPONS /coupons …
CUSTOMERS  /customers …     PRESCRIPTIONS /prescriptions …
REVIEWS /reviews …          TESTIMONIALS /testimonials …

REPORTS
GET /reports/sales  /products  /customers  /inventory  /locations
    /prescriptions  /coupons  /gst  /export
    ?preset=today|yesterday|week|month|quarter|year  ya  ?from_date=&to_date=
    ?orderFrom=web|app   ?group_by=day|week|month

SETTINGS /settings /banners /deals /offers /cities
CMS      /pages /news /enquiries

ADMIN USERS & ROLES
GET  /admins   POST /admins   PATCH /admins/:id   DELETE /admins/:id
POST /admins/:id/reset-password    PATCH /admins/:id/status
GET  /roles    GET /roles/permissions    POST /roles    PUT /roles/:id
GET  /activity-logs
```

---

## Inventory management

Stock ab **numeric** hai (`products.stock_quantity`), sirf In/Out enum nahi.
Har change `inventory_logs` me record hoti hai — kabhi bhi audit kar sakte ho.

- Order place hone pe stock **row lock** ke saath ghatta hai — do log ek saath aakhri
  unit nahi le sakte
- Order cancel hone pe stock **wapas** aa jaata hai
- `low_stock_alert` se neeche gaye to dashboard pe alert
- `expiry_date` ke hisaab se "expiring soon" report (pharma ke liye zaroori)
- `allow_backorder` on kar do to stock 0 hone pe bhi order le sakta hai

Change types: `purchase`, `sale`, `return`, `adjustment`, `damage`, `expiry`, `initial`

---

## RBAC — sub-admin aur employee

Sab ek hi `admins` table me hain, **role** decide karta hai kaun kya kar sakta hai.
Permission format: `module.action` (jaise `orders.manage`, `inventory.view`).

Naya role banane ke liye `POST /admin/roles` — ya `src/config/constants.js` me
`DEFAULT_ROLES` me add karke `npm run seed` chala do.

Permissions Redis me 5 min cache hoti hain (har request pe DB hit nahi hota).
Role update karte hi cache apne aap clear ho jaata hai.

---

## Redis caching

`src/utils/cache.js`:
- `getOrSet(key, ttl, fn)` — cache-aside
- `cache.invalidate.products()` / `.categories()` / `.orders()` … — write pe auto-clear
- `delByPrefix()` SCAN use karta hai (KEYS nahi — production safe)

**Redis down ho jaye to app crash nahi hoti** — seedha DB se data aata hai.

Cached: home feed, product list/detail, categories, banners, settings, dashboard,
reports, RBAC permissions. TTL 30s se 1hr tak, data ke hisaab se.

---

## Payment flow (Razorpay)

1. `POST /orders/checkout` with `payment_mode: "online"` → order + Razorpay order dono
   ban jaate hain, response me `razorpay.order_id` + `key_id` milta hai
2. Client `checkout.js` open karta hai → success pe `POST /orders/verify-payment`
3. Backup: webhook `POST /api/app/payments/razorpay/webhook` — Razorpay dashboard me
   URL daalo, events: `payment.captured`, `payment.failed`, `refund.processed`,
   aur secret ko `RAZORPAY_WEBHOOK_SECRET` me rakho

COD orders seedha `New` status pe ban jaate hain, gateway involve nahi hota.
Delivered mark karte hi COD order automatically `Paid` ho jaata hai.

---

## Folder structure

```
server.js
src/
  config/       db.js (pool + withTransaction), redis.js, constants.js (permissions/statuses)
  migrations/   001_schema_refactor.sql, run-migration.js, seed.js
  middleware/   auth.js, adminAuth.js (RBAC), upload.js, validate.js, errorHandler.js
  utils/        response.js, cache.js, helpers.js, queryBuilder.js
  models/       order, product, inventory, prescription, customer, admin, category,
                coupon, cart, address, wishlist, review, settings, cms, report
  services/     order.service.js (checkout/cancel ka poora logic), razorpay, sms
  controllers/
    app/        auth, catalog, cart, order, prescription, payment, cms
    admin/      auth, dashboard, order, product, inventory, customer, prescription,
                catalog, settings, report, admin
  routes/       app.routes.js, admin.routes.js, index.js
```

**Model add karna ho future me:** `src/models/` me file banao, `QueryBuilder` use karo
filters ke liye, `pickDefined()` se mass-assignment se bacho. Koi ORM nahi hai to
migration ki zaroorat nahi — seedha SQL likhо.

---

## Security jo laga hua hai

- Password bcrypt (10 rounds)
- JWT alag secrets customer aur admin ke liye
- Rate limit: general 1000/15min, auth endpoints 20/15min
- **Price hamesha server-side** — client ki bheji hui price kabhi trust nahi karte
- Mass-assignment protection (`WRITABLE` whitelist har model me)
- SQL injection safe (sab kuch placeholders se bind)
- Sort column whitelist se hi aata hai
- Razorpay signature `timingSafeEqual` se verify
- Helmet, CORS whitelist, compression
- Admin apna khud ka role change / khud ko deactivate nahi kar sakta (lockout se bachne ke liye)

---

## Baaki jo abhi nahi hai (bolo to add kar dun)

- Email notifications (SMS lagi hui hai, email nahi)
- PDF invoice generate (structured data `/orders/:id/invoice` se aa jaata hai, PDF frontend banaye ya bolo backend me karun)
- Partial refund (poora refund hota hai abhi)
- Product variants (size/pack-size wise alag SKU)
- Shiprocket/Delhivery jaisa courier API integration (tracking fields hain, manual entry hoti hai)
