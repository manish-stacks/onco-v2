import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Card, Loader, PrimaryButton, SectionTitle, StickyBottom } from '../components/ui';
import { colors } from '../theme';
import { orderApi } from '../api';
import { money } from '../utils/format';
import { useToast } from '../store/ToastContext';

const LABELS = {
  razorpay: { title: 'UPI, Cards, Netbanking', sub: 'Secured by Razorpay', icon: 'card-outline' },
  payu: { title: 'UPI, Cards, Wallets', sub: 'Secured by PayU', icon: 'card-outline' },
};

export default function PaymentMethodScreen({ route, navigation }) {
  const { amount, codAllowed = true, selected } = route.params || {};
  const [gateways, setGateways] = useState([]);
  const [codEnabled, setCodEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState(selected || null);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const data = await orderApi.gateways();
        const list = data?.available || [];
        setGateways(list);
        setCodEnabled(!!data?.cod_enabled && codAllowed);
        if (!choice) {
          const def = data?.default && list.some((g) => g.id === data.default) ? data.default : list[0]?.id;
          if (def) setChoice({ payment_mode: 'online', payment_gateway: def });
          else if (data?.cod_enabled && codAllowed) setChoice({ payment_mode: 'cod' });
        }
      } catch (e) {
        toast.show(e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isActive = (mode, gateway) =>
    choice?.payment_mode === mode && (mode === 'cod' || choice?.payment_gateway === gateway);

  const Option = ({ title, sub, icon, active, onPress, disabled }) => (
    <Pressable onPress={disabled ? undefined : onPress}>
      <Card style={[styles.option, active && { borderWidth: 1.5, borderColor: colors.primary }, disabled && { opacity: 0.5 }]}>
        <View style={styles.optIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optTitle}>{title}</Text>
          {sub ? <Text style={styles.optSub}>{sub}</Text> : null}
        </View>
        <View style={[styles.radio, active && styles.radioOn]} />
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <AppHeader title="Payment" back />
      {loading ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          <SectionTitle title="Pay online" />
          {gateways.length === 0 ? (
            <Text style={styles.note}>Online payment is unavailable right now.</Text>
          ) : (
            gateways.map((g) => {
              const meta = LABELS[g.id] || { title: g.name || g.id, sub: '', icon: 'card-outline' };
              return (
                <Option
                  key={g.id}
                  title={meta.title}
                  sub={meta.sub}
                  icon={meta.icon}
                  active={isActive('online', g.id)}
                  onPress={() => setChoice({ payment_mode: 'online', payment_gateway: g.id })}
                />
              );
            })
          )}

          <SectionTitle title="More options" />
          <Option
            title="Cash on Delivery"
            sub={
              !codAllowed
                ? 'Not available for some items in your cart'
                : !codEnabled
                ? 'Currently unavailable'
                : 'Pay when your order arrives'
            }
            icon="cash-outline"
            active={isActive('cod')}
            disabled={!codEnabled}
            onPress={() => setChoice({ payment_mode: 'cod' })}
          />
        </ScrollView>
      )}

      <StickyBottom>
        <PrimaryButton
          title={amount ? `Confirm · ${money(amount)}` : 'Confirm'}
          disabled={!choice}
          onPress={() => navigation.navigate({ name: 'Checkout', params: { paymentChoice: choice }, merge: true })}
        />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  optSub: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  note: { fontSize: 12, color: colors.muted, marginBottom: 12 },
});
