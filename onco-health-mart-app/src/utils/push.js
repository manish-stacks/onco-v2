import { Platform } from 'react-native';

/**
 * Returns the native FCM/APNs device token, which is exactly what the backend
 * stores via POST /auth/device-token. Every failure path is swallowed — push is
 * a nice-to-have, it must never block login.
 */
export async function getPushToken() {
  try {
    const Notifications = require('expo-notifications');
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Order updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const device = await Notifications.getDevicePushTokenAsync();
    return device?.data || null;
  } catch {
    return null;
  }
}

export function configureNotificationHandler() {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    /* ignore */
  }
}
