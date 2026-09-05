import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import { mediaUrl } from '../api/client';
import { discountPercent, inStock, isRx, money, num } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { QtyStepper } from './ui';

export default function ProductCard({ product, style, width }) {
  const navigation = useNavigation();
  const { add, updateQty, findLine } = useCart();
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const line = findLine(product.product_id);
  const off = discountPercent(product.product_mrp, product.product_sp);
  const available = inStock(product);
  const img = mediaUrl(product.image_1);

  const requireLogin = () => {
    toast.show('Please log in to continue');
    navigation.navigate('Login');
  };

  const onAdd = async () => {
    if (!isLoggedIn) return requireLogin();
    setBusy(true);
    try {
      await add(product.product_id, 1);
      toast.show('Added to the cart', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const change = async (qty) => {
    setBusy(true);
    try {
      await updateQty(line.cart_id, qty);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      style={[styles.card, shadow, width ? { width } : null, style]}
      onPress={() => navigation.navigate('Product', { slug: product.slug })}
    >
      {off > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{off}% OFF</Text>
        </View>
      ) : null}
      {isRx(product) ? (
        <View style={styles.rx}>
          <Text style={styles.rxText}>Rx</Text>
        </View>
      ) : null}

      <View style={styles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} resizeMode="contain" />
        ) : (
          <Ionicons name="medkit-outline" size={26} color={colors.primary} />
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.product_name}
      </Text>
      <Text style={styles.desc} numberOfLines={1}>
        {product.weight_quantity || product.brand_name || ' '}
      </Text>

      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.price}>{money(product.product_sp)}</Text>
          {num(product.product_mrp) > num(product.product_sp) ? (
            <Text style={styles.mrp}>{money(product.product_mrp)}</Text>
          ) : null}
        </View>

        {!available ? (
          <Text style={styles.oos}>Out of stock</Text>
        ) : line ? (
          <QtyStepper
            compact
            busy={busy}
            value={line.product_quantity}
            onDec={() => change(line.product_quantity - 1)}
            onInc={() => change(line.product_quantity + 1)}
          />
        ) : (
          <Pressable style={styles.addBtn} onPress={onAdd} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.addText}>Add</Text>}
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 10,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  rx: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  rxText: { fontSize: 8.5, color: colors.primaryDark, fontWeight: '700' },
  imgWrap: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  name: { fontSize: 12, fontWeight: '600', color: colors.text, lineHeight: 16 },
  desc: { fontSize: 10, color: colors.muted, marginTop: 2, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  price: { fontSize: 13, fontWeight: '700', color: colors.text },
  mrp: { fontSize: 10, color: colors.muted, textDecorationLine: 'line-through' },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  addText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  oos: { fontSize: 10, color: colors.accent, fontWeight: '700' },
});
