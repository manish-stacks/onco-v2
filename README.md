# Changes — read this before copying files in

This zip has the SAME folder structure as your 4 projects (admin/backend/frontend/mobile-app).
Copy each file to the matching path in your real project. A few changes are
FOLDER RENAMES, which a file-overlay can't do by itself — steps for those are below.

---

## 1) frontend — folder renames (do these FIRST, then copy the files)

```
src/app/category/          →  src/app/products/
src/app/medicines/[slug]/  →  src/app/product-details/[id]/[slug]/
```

After renaming, copy in the updated files from this zip (they already have the
new content for the new paths):
- `src/app/[slug]/page.tsx`                         → NEW — renders admin-created
  CMS pages (privacy-policy, terms-and-conditions, etc.) — this fixes the 404.
- `src/app/products/page.tsx`
- `src/app/products/[slug]/page.tsx`
- `src/app/products/[slug]/about/page.tsx`
- `src/app/product-details/[id]/[slug]/page.tsx`
- `next.config.ts` — added 301 redirects from the OLD URLs (`/category/...`,
  `/medicines/...`, `/pages/...`) to the new ones, so your existing Google
  ranking carries over instead of resetting. Also added avif/webp image
  formats (item 8, smoother image loading).
- All other files in the list below are just link-text updates
  (`/category/x` → `/products/x`, `/medicines/x` → `/product-details/id/x`).

Every other frontend file in this zip:
`components/layout/footer.tsx`, `components/layout/MegaMenu.tsx`,
`components/layout/navbar.tsx`, `components/layout/mobile-bottom-nav.tsx`,
`components/sections/SearchSuggest.tsx`, `category-listing.tsx`,
`category-grid.tsx`, `hero.tsx`, `CategoriesGrid.tsx`, `ProductReviews.tsx`,
`components/product/product-card.tsx`, `components/ui/back-to-top.tsx`,
`app/search/page.tsx`, `app/account/page.tsx`, `app/cart/page.tsx`,
`app/wishlist/page.tsx`.

`footer.tsx` also now links straight to `/privacy-policy`, `/terms-and-conditions`,
`/delivery-shipping-policy`, `/return-and-cancellation-policy` — matching the
slugs shown in your admin Pages screenshot.

`back-to-top.tsx` and `category-grid.tsx` — throttled their scroll/resize
handlers (item 8 — this was the main cause of scroll jank; they were calling
setState on every single scroll pixel).

---

## 2) backend — no renames, just drop these in

- `src/config/media.js` — Media Migration source changed to
  `https://demo.oncohealthmart.com` (item 9). **If `LEGACY_MEDIA_BASE_URL` is
  set in your server's `.env`, update it there too — the env var wins over
  this default.**
- `src/routes/app.routes.js` + `src/controllers/app/auth.controller.js` +
  `src/models/customer.model.js` — new `DELETE /auth/me` endpoint (item 5).
  Deletion **anonymizes** the customer row (name/email/mobile/address wiped,
  login disabled) rather than hard-deleting — orders/prescriptions stay intact
  for accounting & legal records. This is normal, Play-Store-compliant
  behaviour, but say if you'd rather hard-delete instead.
- `src/services/seo.service.js` — sitemap.xml generator updated to emit the
  new URL patterns, and now also includes your CMS pages (it had a
  code comment noting this was skipped until a `/[slug]` route existed —
  it exists now).

## 3) admin — no renames

- `src/pages/orders/Invoice.jsx` — the one Hindi line on the **printed
  customer invoice** translated to English.
- `src/pages/settings/Settings.jsx` — Hindi hint text in the Settings page
  translated to English.

(Everywhere else Hindi/Hinglish showed up was in code *comments*, not
anything a user/admin/customer sees — left alone to save you review time.
Say the word if you want those cleaned too.)

## 4) mobile-app — no renames

- `app.json` — removed `READ_MEDIA_IMAGES` permission (this is what Play
  Console's "use alternative system pickers" warning was about); added
  `expo-build-properties` plugin targeting API 36 / Android 16 (item 6).
- `package.json` — added `expo-build-properties` dependency. Run
  `npm install` after copying this in.
- `src/screens/RxUploadScreen.js` — gallery picker no longer requests the
  broad media-library permission before opening; it now goes straight to the
  OS Photo Picker, which needs no permission. Camera picker untouched (camera
  still correctly asks for CAMERA permission).
- `src/screens/ProfileScreen.js`, `src/store/AuthContext.js`,
  `src/api/index.js` — new **Delete account** option on the Profile screen
  (item 5), with a two-step confirmation since it's irreversible. Calls the
  new backend `DELETE /auth/me`.

### Still needed on your side for the Play Store issues (item 2)
The two SSL-cert issues were both because the declared URLs 404'd — once
you deploy the frontend fix above, re-check both URLs actually load, then
re-submit for review. If your Play Console **Data Safety** form still points
at the old privacy-policy/account-deletion URLs, double check they match
`/privacy-policy` etc. (no `/pages/` prefix).

After all 4 are deployed: `eas build --platform android`, upload, and the
target-API and picker warnings should clear. I can't run an actual EAS build
from here (no network access to Expo's build servers in this environment),
so please do a real test build before submitting.
