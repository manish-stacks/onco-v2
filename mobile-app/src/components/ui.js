import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, shadow } from '../theme';
import { statusTone } from '../utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../store/CartContext';
import { goTab, TABS } from '../utils/nav';

// ---------------------------------------------------------------------------
export function Card({ style, children, ...rest }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function Section({ style, children }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
export function PrimaryButton({ title, onPress, loading, disabled, style, textStyle }) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btnPrimary,
        shadow,
        off && styles.btnDisabled,
        pressed && !off && { opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.btnPrimaryText, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function OutlineButton({ title, onPress, style, textStyle, icon, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.8 }, disabled && { opacity: 0.5 }, style]}
    >
      {icon ? <Ionicons name={icon} size={15} color={colors.primary} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.btnOutlineText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
export function Field({ label, style, ...props }) {
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
export function Pill({ text, tone = 'info', style }) {
  const map = {
    info: { bg: colors.primaryLight, fg: colors.primaryDark },
    success: { bg: colors.successLight, fg: colors.success },
    warn: { bg: colors.warnLight, fg: colors.warn },
    danger: { bg: colors.accentLight, fg: colors.accent },
  };
  const t = map[tone] || map.info;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function StatusPill({ status, style }) {
  if (!status) return null;
  return <Pill text={status} tone={statusTone(status)} style={style} />;
}

export function Chip({ text, onPress, active, style, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, style]}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={active ? '#fff' : colors.text} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.chipText, active && { color: '#fff', fontWeight: '600' }]}>{text}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
export function AppHeader({ title, back = false, right, subtitle, onRightPress, rightIcon }) {
  const navigation = useNavigation();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {back ? (
          <Pressable style={[styles.iconBtn, shadow]} onPress={() => navigation.goBack()} hitSlop={6}>
            <Ionicons name="chevron-back" size={19} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: back ? 'center' : 'flex-start' }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
        {right ||
          (rightIcon ? (
            <Pressable style={[styles.iconBtn, shadow]} onPress={onRightPress} hitSlop={6}>
              <Ionicons name={rightIcon} size={18} color={colors.text} />
            </Pressable>
          ) : null)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Cart icon + live badge, for any screen's AppHeader `right` slot:
 *   <AppHeader title="Category" back right={<CartHeaderButton />} />
 * Screens that don't pass this (like ProductListScreen was) show no cart
 * indicator at all until the user backs out to a tab screen — this is the
 * fix for that.
 */
export function CartHeaderButton() {
  const navigation = useNavigation();
  const { count } = useCart();
  return (
    <Pressable style={[styles.iconBtn, shadow]} onPress={() => goTab(navigation, TABS.cart)} hitSlop={6}>
      <Ionicons name="cart-outline" size={18} color={colors.text} />
      {count > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
export function QtyStepper({ value, onDec, onInc, busy, compact }) {
  return (
    <View style={[styles.qty, compact && { paddingVertical: 2 }]}>
      <Pressable onPress={onDec} disabled={busy} hitSlop={8} style={styles.qtyBtn}>
        <Ionicons name="remove" size={14} color={colors.primaryDark} />
      </Pressable>
      {busy ? (
        <ActivityIndicator size="small" color={colors.primaryDark} style={{ width: 18 }} />
      ) : (
        <Text style={styles.qtyValue}>{value}</Text>
      )}
      <Pressable onPress={onInc} disabled={busy} hitSlop={8} style={styles.qtyBtn}>
        <Ionicons name="add" size={14} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
export function Loader({ style }) {
  return (
    <View style={[{ paddingVertical: 40, alignItems: 'center' }, style]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function EmptyState({ icon = 'cube-outline', title, subtitle, actionTitle, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {actionTitle ? (
        <PrimaryButton title={actionTitle} onPress={onAction} style={{ marginTop: 18, width: 220 }} />
      ) : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

export function Row({ left, right, bold, style, rightColor }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.rowLeft, bold && styles.rowBold]}>{left}</Text>
      <Text style={[styles.rowRight, bold && styles.rowBold, rightColor && { color: rightColor }]}>{right}</Text>
    </View>
  );
}

export function StickyBottom({ children, style }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.sticky,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    ...shadow,
  },
  section: { paddingHorizontal: 18, paddingBottom: 18 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleText: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  sectionAction: { fontSize: 11.5, color: colors.primary, fontWeight: '600' },

  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { backgroundColor: colors.disabled },
  btnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnOutlineText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  label: { fontSize: 11, color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    color: colors.text,
    marginBottom: 12,
  },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xs, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '700' },

  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: { fontSize: 11.5, color: colors.text },

  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: { width: 42, justifyContent: 'center' },
  headerTitle: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 10.5, color: colors.muted, marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent || '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12, includeFontPadding: false },

  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtn: { paddingHorizontal: 2 },
  qtyValue: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 10 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLeft: { fontSize: 12.5, color: colors.muted, flex: 1, marginRight: 10 },
  rowRight: { fontSize: 12.5, color: colors.text, fontWeight: '500' },
  rowBold: { fontWeight: '700', color: colors.ink },

  sticky: {
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export { styles as uiStyles };
