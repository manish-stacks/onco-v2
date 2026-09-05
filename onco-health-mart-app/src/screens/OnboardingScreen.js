import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { PrimaryButton } from '../components/ui';
import { colors } from '../theme';
import { useAuth } from '../store/AuthContext';

const SLIDES = [
  {
    icon: 'medkit',
    title: 'Order medicines in minutes',
    text: 'Genuine oncology and everyday medicines, delivered to your door.',
  },
  {
    icon: 'document-text',
    title: 'Upload your prescription',
    text: 'Snap a photo, our pharmacists verify it and prepare your order.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Track every order',
    text: 'Live status updates from packing to delivery, plus easy reorders.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const { completeOnboarding } = useAuth();
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <Screen style={styles.wrap}>
      <Pressable style={styles.skip} onPress={completeOnboarding}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={slide.icon} size={60} color={colors.primary} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.icon} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <PrimaryButton
          title={last ? 'Get started' : 'Next'}
          onPress={() => (last ? completeOnboarding() : setIndex(index + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between' },
  skip: { alignSelf: 'flex-end', padding: 18 },
  skipText: { color: colors.muted, fontSize: 13 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.primary },
});
