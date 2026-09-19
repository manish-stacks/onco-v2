# Onco Health Mart — Expo React Native App

Customer app for Onco Health Mart. Talks to the same backend the website uses
(`/api/app/*`) with the header `X-Client-Platform: app`, so `orders.orderFrom`
and `prescriptions.source` are recorded as `app` automatically.

Navigation is **React Navigation** (stack + bottom tabs). Expo Router is not used.

## Setup

```bash
npm install
npx expo start
```

## Backend URL

Set it once in `app.json` → `expo.extra.apiBase`:

```json
"extra": { "apiBase": "https://www.api.oncohealthmart.com" }
```

For production change it to `https://api.oncohealthmart.com`.

## Build

The Android package (`com.happy_coding.app`), iOS bundle id, EAS `projectId`,
`owner`, `slug`, `version` and the update URL are unchanged from your old
`app.json`, so OTA updates and store listings keep working.

```bash
eas build -p android --profile production
eas update --branch production
```

Note: `expo-image-picker` and `expo-notifications` were added, so a **new native
build** is needed once. After that, OTA updates work again as before.

## Structure

```
src/
  api/client.js        fetch wrapper, SecureStore token, mediaUrl()
  api/index.js         every backend endpoint, grouped
  store/               Auth, Cart, Settings, Toast contexts
  navigation/          RootNavigator (stack) + TabNavigator
  components/          ui.js kit, ProductCard, Screen
  screens/             26 screens
  theme/               design tokens from the HTML prototype
  utils/               format helpers, push token, tab navigation helper
```

## Screens

Splash, Onboarding, Login, OTP, Home, Search, Categories, Product list,
Product detail, Cart, Apply coupon, Address list, Add/Edit address, Checkout,
Payment method, Payment gateway (WebView), Order success, Orders, Order detail,
Tracking, Prescription upload, Prescription list, Prescription detail, Offers,
Wishlist, Notifications, Profile, Edit profile, Help & support, CMS page,
Settings.

## Payments

Both gateways run inside a WebView:

* **Razorpay** — `checkout.js` is loaded, the handler posts the signature back
  and the app calls `POST /orders/verify-payment`.
* **PayU** — a hidden form auto-submits to the PayU endpoint; when the browser
  returns to the backend success URL the app calls `POST /payments/payu/verify`.

Nothing on the backend needed changing for this — `payment.razorpay` and
`payment.payu` are already returned by `/orders/checkout`.

## Push notifications

`getDevicePushTokenAsync()` returns the native FCM/APNs token, which is exactly
what `POST /auth/device-token` stores. Every failure path is swallowed so push
never blocks login. For Android you still need `google-services.json` wired into
your EAS build.
