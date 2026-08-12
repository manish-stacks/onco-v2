# oncohealthmart — Admin Panel

React 18 + Vite + Tailwind CSS. Backend (`oncohealthmart-backend`) ke saare 184 endpoints ismein wired hain.

---

## Setup

```bash
cd admin-panel
npm install
cp .env.example .env
npm run dev          # http://localhost:5174
```

Backend port 4000 pe chalna chahiye. Dev me `/api` requests vite proxy se backend pe chali jaati hain — CORS ka jhanjhat nahi.

Production build:
```bash
npm run build        # dist/ folder banta hai
npm run preview      # build ko locally check karne ke liye
```

Production me `.env` me `VITE_API_BASE=https://api.oncohealthmart.com` set karo.

**Login:** backend me `npm run seed` chalane ke baad — `superadmin` / `Admin@123`

---

## Design

Ye ek ops tool hai — log ispe 8 ghante baithte hain, isliye density aur scan-ability pe focus hai, decoration pe nahi.

**Palette:** deep petrol-slate (`#12212B`) chrome ke liye, clinical teal (`#0E7C7B`) actions ke liye, aur ek signal system — amber low stock, rose out-of-stock/expiry, green delivered.

**Type:** IBM Plex Sans + IBM Plex Mono. Mono ka use deliberate hai — pharmacy me sab kuch codes me chalta hai: order ref, SKU, HSN, batch number, AWB, transaction id. Har identifier mono me set hai, to 50-row table me code dhoondhna instant ho jaata hai.

**Status rail:** har table row ke left me 3px ka colored bar hai jo status encode karta hai. Order list scroll karte waqt status column padhe bina hi pata chal jaata hai kya pending hai, kya cancelled.

Tables me `tabular-nums` lagi hai — numbers column me align rehte hain.

---

## Kya-kya hai

### Dashboard
Alert strip sabse upar (out of stock, low stock, expiring batches, pending prescriptions — sab clickable), revenue/orders/customers/stock-value cards, sales trend chart, web-vs-app split, order pipeline, top products, low stock list, latest orders. Date preset dropdown se poora dashboard filter hota hai.

### Orders
Web aur app dono ek hi list me — upar tabs se filter (`?orderFrom=web|app`, ya dono). Search order ref/naam/phone/AWB pe, filters status/payment/mode/date range. CSV export.

**Detail page:** items table with per-item GST breakdown, status timeline (har change ka audit), customer + shipping blocks, prescription thumbnails, payment block. Actions — status move (sirf allowed transitions dikhte hain, backend flow validation ke hisaab se), tracking update, manual payment mark, cancel.

Cancel modal batata hai exactly kya hoga: kitne items ka stock wapas aayega, coupon use wapas milega ya nahi, aur refund kitna start hoga.

### Prescriptions
Web + app ek hi table se. Images JSON array se aati hain — 1 ho ya 10, sab grid me dikhti hain, click pe lightbox. Review modal se status change (reject pe reason mandatory), aur "suggest medicines" se admin prescription padh ke medicines list kar sakta hai.

### Products
Full CRUD — 5-tab form (basic / pricing & stock / description / images / SEO), multi-image upload with preview, category multi-select chips, slug auto-generate. Bulk status toggle, CSV export.

Edit mode me stock field disabled hai — stock sirf Inventory page se change hota hai taaki har change ka audit trail bane.

### Inventory
3 tabs:
- **Stock levels** — har product ka on-hand, value, alert threshold. Teen actions: stock aaya (+), stock nikaalo (−), exact count set karo. Har action modal me "abhi → baad me" preview dikhata hai.
- **Movement ledger** — poora audit trail, type/date filter, CSV export
- **Expiring soon** — 30/60/90/180 din ka window, din-bache count ke saath

Upar 5 summary cards — stock value, total units, low stock, out of stock, expiring.

### Customers
List me order count + lifetime value + last order. Detail page 360 view — stats, recent orders, saved addresses, block/unblock.

### Catalog
Categories (parent-child support), Brands, Coupons (usage report ke saath), Reviews (approve/reject moderation).

### Reports
7 tabs — Sales (trend chart, web-vs-app, status, payment breakdown), Products (top sellers, category performance, dead stock), Customers (retention, signup growth stacked chart, top buyers), Locations (city/state), Prescriptions, Coupons, GST (HSN-wise, accountant ke liye). Har report CSV export ho sakti hai, aur web/app filter lagta hai.

### Team & access
- **Members** — sub-admin aur employee dono yahan se bante hain, role decide karta hai access
- **Roles** — permission matrix, module-wise grouped checkboxes with "select all" per module. System roles delete nahi ho sakte but edit ho sakte hain.
- **Activity log** — kisne kya kiya, kab, kaunse IP se

### Storefront + Content
Site settings (shipping threshold, COD fee, social links, logo), banners, deals, offer cards, delivery cities. CMS — pages, news/blog, contact enquiries.

---

## Permissions

Sidebar aur har route permission ke hisaab se filter hote hain. Login response me `permissions` array aata hai (backend ke `role_permissions` se), aur `useAuth().can('orders.manage')` se check hota hai.

Permission na ho to blank page nahi milta — ek clean "is section ka access nahi hai" message dikhta hai.

RBAC frontend me sirf UX ke liye hai — asli enforcement backend pe hoti hai. Button hide karna security nahi hai.

---

## Structure

```
src/
  lib/          api.js (fetch wrapper + CSV download), constants.js, format.js
  context/      AuthContext (login + permissions), ToastContext
  hooks/        useApi.js — useList / useResource / useMutation / useDebounced
  components/
    ui/         index.jsx (Button, Field, Input, Card, StatusPill, Code…)
                Modal.jsx (Modal, ConfirmDialog, Drawer)
                DataTable.jsx (table + pagination + filter bar)
    layout/     Sidebar, Topbar, Layout (AppLayout, ProtectedRoute, PermissionGate, PageHeader)
  pages/        Login, Dashboard, orders/, products/, inventory/, customers/,
                prescriptions/, catalog/, reports/, settings/, cms/, admins/
```

**Naya page add karna ho:** `useList('/admin/xyz')` hook lo, `DataTable` + `FilterBar` + `Pagination` compose karo, `App.jsx` me route add karo `<Guard perm={...}>` ke saath, aur `Sidebar.jsx` ke NAV array me entry daalo. Baaki sab handle ho jaata hai — loading states, empty states, error toasts, pagination.

---

## Data fetching

`useList` — pagination + filters + debounced search + stale-response guard (purani request naye result ko overwrite nahi karti).
`useResource` — single record.
`useMutation` — loading state + success toast + field-level validation errors, sab automatic.

401 aane pe api client AuthContext ko signal bhejta hai aur user login pe redirect ho jaata hai.

---

---

## Rich text editor

`src/components/ui/RichTextEditor.jsx` — CMS pages aur news dono me laga hai.

Koi external library nahi — contenteditable + `execCommand` pe chalta hai. Bold/italic/underline, H2/H3, quote, bullet aur numbered lists, links, clear formatting, undo/redo. Toolbar buttons cursor position ke hisaab se active/inactive dikhte hain.

Do cheezein deliberate hain:
- **Paste pe formatting strip hoti hai.** Word ya Google Docs se copy karne pe jo gandi HTML aati hai wo plain text ban jaati hai.
- **HTML toggle** — toolbar ke right me "HTML" button hai. Raw markup edit karna ho to switch kar lo, wapas aa jao.

Content HTML string ke roop me `content` column me waise hi store hota hai, jaise pehle textarea se hota tha — backend me kuch change nahi karna pada.

`execCommand` technically deprecated hai, lekin har browser me kaam karta hai aur iske liye 100KB+ ki library kheenchne ka matlab nahi banta. Agar aage tables ya image embed chahiye ho to tab TipTap ya Lexical pe shift kar lenge.

## Invoice print view

Route: `/orders/:orderId/invoice` — order detail page pe "Invoice" button se naye tab me khulta hai.

Browser ka apna print-to-PDF use karta hai, koi PDF library nahi. Print styles `index.css` me hain — A4 size, 14mm margin, sidebar/topbar/buttons gayab, page breaks items ke beech nahi tootte.

Layout me hai: seller block (logo + address), invoice number + date, bill-to aur ship-to side by side, payment status, line items with SKU/HSN per row, **HSN-wise tax summary table** (accountant ko yahi chahiye hota hai), aur totals.

Ctrl+P bhi utna hi kaam karta hai jitna button.

## Bulk stock import

Inventory page pe "Bulk import" button. CSV **browser me hi parse hoti hai** — server pe file upload nahi hoti, sirf saaf-suthra JSON jaata hai `/admin/inventory/bulk` pe.

Columns: `product_id`, `stock_quantity`, aur optional `note`. Header case-insensitive hai, extra columns ignore ho jaate hain. Modal me sample CSV download karne ka link hai.

Flow: file drop karo → parse + validate → preview table (invalid rows highlighted, error reason ke saath) → "Update N products". Invalid rows skip ho jaati hain, valid chali jaati hain — poori import fail nahi hoti ek galat row se.

Ye **exact stock set** karta hai (add nahi karta) — stock-taking ke baad ke liye bana hai. Har row inventory ledger me `adjustment` type se record hoti hai, to audit trail bana rehta hai.

## Real-time updates (SSE)

Polling hata di. Ab backend se Server-Sent Events aate hain — `src/hooks/useLiveEvents.js`.

Jo events aate hain: `order.created`, `order.paid`, `order.status`, `prescription.created`, `stock.out`, `stock.changed`. Naya order aate hi sidebar badge badhta hai aur toast dikhta hai — refresh karne ki zaroorat nahi.

Sidebar ke bottom me connection indicator hai — green pulse = live, grey = polling fallback.

Kuch practical baatein:
- **EventSource custom headers nahi bhej sakti**, isliye token query param me jaata hai. Nginx me is path ka access log band kar do taaki token logs me na aaye (config niche backend README me hai).
- Reconnect khud handle karte hain, exponential backoff ke saath (2s → 4s → … max 30s). EventSource ka apna reconnect token expire hone pe infinite loop bana deta hai.
- Tab background me jaake wapas aata hai to turant reconnect hota hai.
- SSE toot jaye to fallback poll chalu ho jaata hai (60s). Connected ho to poll 5 min pe slow ho jaata hai — counts exact rakhne ke liye.

Events **permission-gated** hain — jiske paas `inventory.view` nahi hai usko stock events nahi jaayenge.

## Baaki jo abhi nahi hai (bolo to add kar dun)

- Dark mode
- Editor me image embed / tables (abhi text formatting hi hai)
- Invoice me QR code aur digital signature
- Multi-warehouse inventory
