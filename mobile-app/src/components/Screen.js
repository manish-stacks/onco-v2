import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function Screen({ children, style, edges = ['top'], white }) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, white && { backgroundColor: colors.card }]}>
      <View style={[styles.body, white && { backgroundColor: colors.card }, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, backgroundColor: colors.bg },
});
