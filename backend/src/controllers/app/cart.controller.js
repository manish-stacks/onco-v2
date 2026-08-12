const cartModel = require('../../models/cart.model');
const wishlistModel = require('../../models/wishlist.model');
const addressModel = require('../../models/address.model');
const couponModel = require('../../models/coupon.model');
const { ok, created, fail, asyncHandler } = require('../../utils/response');

// ---------------------------------------------------------------------------
// CART
// ---------------------------------------------------------------------------
const getCart = asyncHandler(async (req, res) => {
  return ok(res, await cartModel.getCartWithTotals(req.customer.customer_id));
});

const cartCount = asyncHandler(async (req, res) => {
  return ok(res, { count: await cartModel.count(req.customer.customer_id) });
});

const addToCart = asyncHandler(async (req, res) => {
  await cartModel.addItem(req.customer.customer_id, {
    product_id: req.body.product_id,
    quantity: parseInt(req.body.quantity, 10) || 1,
  });
  return created(res, await cartModel.getCartWithTotals(req.customer.customer_id), 'Cart me add ho gaya');
});

const updateCartItem = asyncHandler(async (req, res) => {
  const updated = await cartModel.updateQuantity(
    req.params.cartId, req.customer.customer_id, parseInt(req.body.quantity, 10)
  );
  if (!updated) return fail(res, 'Cart item nahi mila', 404);
  return ok(res, await cartModel.getCartWithTotals(req.customer.customer_id), 'Cart update ho gaya');
});

const removeCartItem = asyncHandler(async (req, res) => {
  const removed = await cartModel.removeItem(req.params.cartId, req.customer.customer_id);
  if (!removed) return fail(res, 'Cart item nahi mila', 404);
  return ok(res, await cartModel.getCartWithTotals(req.customer.customer_id), 'Item hata diya');
});

const clearCart = asyncHandler(async (req, res) => {
  await cartModel.clear(req.customer.customer_id);
  return ok(res, null, 'Cart khaali kar diya');
});

/** App offline tha, local cart server pe bhejna hai */
const mergeCart = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  return ok(res, await cartModel.mergeCart(req.customer.customer_id, items), 'Cart merge ho gaya');
});

/** POST /cart/apply-coupon — order banaye bina coupon check */
const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await cartModel.getCartWithTotals(req.customer.customer_id);
  if (!cart.items.length) return fail(res, 'Cart khaali hai', 409);

  const result = await couponModel.validateForCart({
    code: req.body.coupon_code,
    customerId: req.customer.customer_id,
    subtotal: cart.summary.subtotal,
    productIds: cart.items.map((i) => i.product_id),
  });

  if (!result.valid) return fail(res, result.reason, 409);
  return ok(res, { coupon_code: req.body.coupon_code, discount: result.discount }, 'Coupon apply ho gaya');
});

/** GET /coupons — available offers */
const availableCoupons = asyncHandler(async (req, res) => {
  return ok(res, await couponModel.activeCoupons());
});

// ---------------------------------------------------------------------------
// WISHLIST
// ---------------------------------------------------------------------------
const getWishlist = asyncHandler(async (req, res) => {
  return ok(res, await wishlistModel.list(req.customer.customer_id));
});

const toggleWishlist = asyncHandler(async (req, res) => {
  const result = await wishlistModel.toggle(req.customer.customer_id, req.body.product_id);
  return ok(res, result, result.added ? 'Wishlist me add ho gaya' : 'Wishlist se hata diya');
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  await wishlistModel.remove(req.customer.customer_id, req.params.productId);
  return ok(res, null, 'Wishlist se hata diya');
});

// ---------------------------------------------------------------------------
// ADDRESSES
// ---------------------------------------------------------------------------
const listAddresses = asyncHandler(async (req, res) => {
  return ok(res, await addressModel.listByCustomer(req.customer.customer_id));
});

const createAddress = asyncHandler(async (req, res) => {
  const id = await addressModel.create(req.customer.customer_id, req.body);
  return created(res, { ad_id: id }, 'Address save ho gaya');
});

const updateAddress = asyncHandler(async (req, res) => {
  const updated = await addressModel.update(req.params.addressId, req.customer.customer_id, req.body);
  if (!updated) return fail(res, 'Address nahi mila', 404);
  return ok(res, null, 'Address update ho gaya');
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const done = await addressModel.setDefault(req.params.addressId, req.customer.customer_id);
  if (!done) return fail(res, 'Address nahi mila', 404);
  return ok(res, null, 'Default address set ho gaya');
});

const removeAddress = asyncHandler(async (req, res) => {
  const removed = await addressModel.remove(req.params.addressId, req.customer.customer_id);
  if (!removed) return fail(res, 'Address nahi mila', 404);
  return ok(res, null, 'Address hata diya');
});

module.exports = {
  getCart, cartCount, addToCart, updateCartItem, removeCartItem, clearCart, mergeCart,
  applyCoupon, availableCoupons,
  getWishlist, toggleWishlist, removeFromWishlist,
  listAddresses, createAddress, updateAddress, setDefaultAddress, removeAddress,
};
