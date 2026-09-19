import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/store/AuthContext';
import { CartProvider } from './src/store/CartContext';
import { SettingsProvider } from './src/store/SettingsContext';
import { ToastProvider } from './src/store/ToastContext';
import { configureNotificationHandler } from './src/utils/push';

export default function App() {
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>
              <CartProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </CartProvider>
            </AuthProvider>
          </SettingsProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}