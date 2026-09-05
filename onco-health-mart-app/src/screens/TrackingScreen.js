import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import { AppHeader, Card, EmptyState, Loader, StatusPill } from '../components/ui';
import { colors } from '../theme';
import { orderApi } from '../api';
import { formatDate } from '../utils/format';

export default function TrackingScreen({ route }) {
  const { orderId } = route.params || {};
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const data = await orderApi.track(orderId);
          if (alive) setTrack(data);
        } catch {
          if (alive) setTrack(null);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [orderId])
  );

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Track Order" back />
        <Loader />
      </Screen>
    );
  }

  if (!track) {
    return (
      <Screen>
        <AppHeader title="Track Order" back />
        <EmptyState icon="navigate-outline" title="Tracking unavailable" />
      </Screen>
    );
  }

  const history = [...(track.history || [])].reverse();

  return (
    <Screen>
      <AppHeader title={`#${track.reference || track.order_id}`} back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>Current status</Text>
            <StatusPill status={track.status} />
          </View>
          {track.tracking_status ? <Text style={styles.meta}>{track.tracking_status}</Text> : null}
          {track.tracking_location ? <Text style={styles.meta}>Location: {track.tracking_location}</Text> : null}
          {track.awb_number ? (
            <Text style={styles.meta}>
              {track.courier_name} · AWB {track.awb_number}
            </Text>
          ) : null}
          {track.delivered_at ? (
            <Text style={styles.meta}>Delivered on {formatDate(track.delivered_at, true)}</Text>
          ) : null}
        </Card>

        <Card style={{ paddingVertical: 16 }}>
          {history.length === 0 ? (
            <Text style={styles.meta}>No updates yet.</Text>
          ) : (
            <View style={styles.timeline}>
              {history.map((h, i) => (
                <View key={`${h.created_at}-${i}`} style={styles.tItem}>
                  <View style={[styles.dot, i > 0 && { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tTitle}>{h.new_status}</Text>
                    <Text style={styles.tTime}>{formatDate(h.created_at, true)}</Text>
                    {h.note ? <Text style={styles.tNote}>{h.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 5, lineHeight: 17 },
  timeline: { borderLeftWidth: 2, borderLeftColor: colors.border, marginLeft: 6, paddingLeft: 18 },
  tItem: { position: 'relative', paddingBottom: 18 },
  dot: {
    position: 'absolute',
    left: -24,
    top: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  tTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  tTime: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  tNote: { fontSize: 11, color: colors.muted, marginTop: 3 },
});
