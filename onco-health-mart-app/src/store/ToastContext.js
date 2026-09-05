import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const show = useCallback(
    (text, type = 'info') => {
      if (!text) return;
      setMsg({ text: String(text), type });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setMsg(null)
        );
      }, 2600);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg ? (
        <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
          <View
            style={[
              styles.toast,
              msg.type === 'error' && { backgroundColor: colors.red },
              msg.type === 'success' && { backgroundColor: colors.primaryDark },
            ]}
          >
            <Text style={styles.text}>{msg.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', paddingHorizontal: 24 },
  toast: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    maxWidth: '100%',
  },
  text: { color: '#fff', fontSize: 12.5, textAlign: 'center' },
});
