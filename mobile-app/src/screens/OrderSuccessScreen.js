import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { OutlineButton, PrimaryButton } from '../components/ui';
import { colors } from '../theme';
import { money } from '../utils/format';
import { goTab, TABS } from '../utils/nav';

export default function OrderSuccessScreen({ route, navigation }) {
  const { order } = route.params || {};

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.circle}>
          <Ionicons name="checkmark" size={44} color="#fff" />
        </View>
        <Text style={styles.title}>Order placed!</Text>
        <Text style={styles.sub}>
          Order #{order?.databaseOrderID || order?.order_id} · {money(order?.amount)}
        </Text>
        <Text style={styles.note}>
          {String(order?.payment_mode).toLowerCase() === 'cod'
            ? Number(order?.cod_advance_amount) > 0
              ? `Your advance is confirmed. Pay the remaining ${money(order?.cod_balance_due ?? 0)} in cash when your order arrives.`
              : 'Pay in cash when your order arrives. We will confirm it shortly.'
            : 'Your payment is confirmed. We will start preparing your order right away.'}
        </Text>

        <View style={{ width: '100%', marginTop: 30 }}>
          <PrimaryButton
            title="Track Order"
            onPress={() => navigation.replace('Tracking', { orderId: order?.order_id })}
          />
          <OutlineButton
            title="Back to Home"
            style={{ marginTop: 10 }}
            onPress={() => {
              navigation.popToTop();
              goTab(navigation, TABS.home);
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  circle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 6 },
  note: { fontSize: 12, color: colors.muted, marginTop: 12, textAlign: 'center', lineHeight: 19 },
});
