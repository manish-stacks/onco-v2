import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { AppHeader, EmptyState, Loader } from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { cartApi } from '../api';
import { formatDate, money, num } from '../utils/format';

export default function OffersScreen() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setCoupons((await cartApi.coupons()) || []);
      } catch {
        setCoupons([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Screen>
      <AppHeader title="Offers & Coupons" back />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(c) => String(c.coupon_id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          ListEmptyComponent={
            <EmptyState icon="pricetags-outline" title="No offers right now" subtitle="Check back soon." />
          }
          renderItem={({ item }) => {
            const percent = num(item.discount_percentage) > 0;
            return (
              <View style={[styles.card, shadow]}>
                <View style={styles.top}>
                  <Text style={styles.code}>{item.coupon_code}</Text>
                  <Text style={styles.value}>
                    {percent ? `${num(item.discount_percentage)}% OFF` : `${money(item.discount_amount)} OFF`}
                  </Text>
                </View>
                <Text style={styles.desc}>
                  On orders above {money(item.minimum_amount)}
                  {num(item.max_discount_amount) > 0 ? ` · Max ${money(item.max_discount_amount)}` : ''}
                </Text>
                {item.expiry_date ? (
                  <Text style={styles.expiry}>Valid till {formatDate(item.expiry_date)}</Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 14, fontWeight: '700', color: colors.text },
  value: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  desc: { fontSize: 11.5, color: colors.muted, marginTop: 6 },
  expiry: { fontSize: 10.5, color: colors.primary, marginTop: 4 },
});
