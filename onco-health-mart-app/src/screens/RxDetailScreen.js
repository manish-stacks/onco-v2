import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Card, EmptyState, Loader, SectionTitle, StatusPill } from '../components/ui';
import ProductCard from '../components/ProductCard';
import { colors, radius } from '../theme';
import { prescriptionApi } from '../api';
import { mediaUrl, isPdfUrl } from '../api/client';
import { formatDate } from '../utils/format';

export default function RxDetailScreen({ route }) {
  const { id } = route.params || {};
  const [rx, setRx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState({});

  useEffect(() => {
    (async () => {
      try {
        setRx(await prescriptionApi.detail(id));
      } catch {
        setRx(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Prescription" back />
        <Loader />
      </Screen>
    );
  }

  if (!rx) {
    return (
      <Screen>
        <AppHeader title="Prescription" back />
        <EmptyState icon="document-text-outline" title="Prescription not found" />
      </Screen>
    );
  }

  const images = Array.isArray(rx.images) ? rx.images : [];

  return (
    <Screen>
      <AppHeader title={rx.reference_code || `#${rx.prescription_id}`} back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>Status</Text>
            <StatusPill status={rx.status} />
          </View>
          <Text style={styles.meta}>Uploaded {formatDate(rx.created_at, true)}</Text>
          {rx.patient_name ? <Text style={styles.meta}>Patient: {rx.patient_name}</Text> : null}
          {rx.doctor_name ? <Text style={styles.meta}>Doctor: {rx.doctor_name}</Text> : null}
          {rx.hospital_name ? <Text style={styles.meta}>Hospital: {rx.hospital_name}</Text> : null}
          {rx.notes ? <Text style={styles.meta}>Notes: {rx.notes}</Text> : null}
          {rx.rejection_reason ? <Text style={styles.reject}>{rx.rejection_reason}</Text> : null}
        </Card>

        <SectionTitle title={`Images (${images.length})`} />
        <View style={styles.grid}>
          {images.map((img) => {
            if (isPdfUrl(img)) {
              return (
                <Pressable key={img} style={[styles.image, styles.pdfTile]} onPress={() => Linking.openURL(mediaUrl(img))}>
                  <Ionicons name="document-text" size={30} color={colors.primary} />
                  <Text style={styles.pdfLabel}>PDF · Tap to open</Text>
                </Pressable>
              );
            }
            if (failed[img]) {
              return (
                <View key={img} style={[styles.image, styles.pdfTile]}>
                  <Ionicons name="image-outline" size={26} color={colors.muted} />
                  <Text style={styles.pdfLabel}>Couldn't load</Text>
                </View>
              );
            }
            return (
              <Pressable key={img} onPress={() => Linking.openURL(mediaUrl(img))}>
                <Image
                  source={{ uri: mediaUrl(img) }}
                  style={styles.image}
                  resizeMode="cover"
                  onError={() => setFailed((f) => ({ ...f, [img]: true }))}
                />
              </Pressable>
            );
          })}
        </View>

        {rx.medicines?.length ? (
          <View style={{ marginTop: 10 }}>
            <SectionTitle title="Suggested medicines" />
            <View style={styles.products}>
              {rx.medicines.map((m) => (
                <ProductCard key={String(m.product_id)} product={m} style={{ width: '48%' }} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 5 },
  reject: { fontSize: 11.5, color: colors.accent, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  image: { width: '47.5%', aspectRatio: 0.8, borderRadius: radius.sm, backgroundColor: colors.primaryLight },
  pdfTile: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  pdfLabel: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },
  products: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
});
