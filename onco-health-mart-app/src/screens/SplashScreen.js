import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function SplashScreen() {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/logo/ic_launcher_foreground.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Onco Health Mart</Text>
      <Text style={styles.sub}>Your health, delivered</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 120, height: 120, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
